import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import type { Ticket, TrackerReadError } from "#src/read.ts";
import { listTickets } from "#src/read.ts";

const TICKETS: Record<string, string> = {
  "a1b2c3-first.md": `---
type: design
project: mvp
clears: [a-patch]
---

# This body is opaque

Body.
`,
  "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

# This heading is not the ticket title

Body.
`,
};

const run = (
  program: Effect.Effect<readonly Ticket[], TrackerReadError, FileSystem.FileSystem | Path.Path>,
  tickets = TICKETS,
  names = ["b1c2d3-second.md", ".DS_Store", "a1b2c3-first.md"],
) =>
  Effect.runPromise(
    Effect.provide(
      program,
      Layer.merge(
        FileSystem.layerNoop({
          readDirectory: () => Effect.succeed(names),
          readFileString: (path) => {
            const name = path.split("/").at(-1) ?? "";
            return Effect.succeed(tickets[name] ?? "");
          },
        }),
        Path.layer,
      ),
    ),
  );

describe("listTickets", () => {
  it("lists the tickets in filename order with parsed fields", async () => {
    const tickets = await run(listTickets("some/tracker"));
    expect(tickets.map((ticket) => ticket.id)).toEqual(["a1b2c3", "b1c2d3"]);
    expect(tickets[0]).toMatchObject({
      id: "a1b2c3",
      slug: "first",
      type: "design",
      project: "mvp",
      blockers: [],
      clears: ["a-patch"],
    });
    expect(tickets[1]).toMatchObject({
      id: "b1c2d3",
      slug: "second",
      type: "build",
      project: undefined,
      blockers: ["a1b2c3"],
      clears: [],
    });
  });

  it("fails with a TrackerReadError when a ticket is malformed", async () => {
    const bad: Record<string, string> = {
      ...TICKETS,
      "z9z9z9-bad.md": "no frontmatter here\n",
    };
    const program = listTickets("some/tracker");
    const failing = Effect.provide(
      program,
      Layer.merge(
        FileSystem.layerNoop({
          readDirectory: () => Effect.succeed(Object.keys(bad)),
          readFileString: (path) => {
            const name = path.split("/").at(-1) ?? "";
            return Effect.succeed(bad[name] ?? "");
          },
        }),
        Path.layer,
      ),
    );
    await expect(Effect.runPromise(failing)).rejects.toMatchObject({ _tag: "TrackerReadError" });
  });

  it("rejects frontmatter fields outside the four-field format", async () => {
    const invalid = {
      "a1b2c3-unknown-field.md": `---
type: build
status: open
---

Body.
`,
    };
    await expect(run(listTickets("some/tracker"), invalid, Object.keys(invalid))).rejects.toMatchObject({
      message: expect.stringContaining("unknown frontmatter field: status"),
    });
  });

  it("distinguishes an absent list from a null list", async () => {
    const invalid = {
      "a1b2c3-null-list.md": `---
type: build
blockers:
---

Body.
`,
    };
    await expect(run(listTickets("some/tracker"), invalid, Object.keys(invalid))).rejects.toMatchObject({
      _tag: "TrackerReadError",
    });
  });

  it("fails when the tickets directory cannot be read", async () => {
    const program = listTickets("missing/tracker");
    const failing = Effect.provide(program, Layer.merge(FileSystem.layerNoop({}), Path.layer));
    await expect(Effect.runPromise(failing)).rejects.toMatchObject({ _tag: "TrackerReadError" });
  });
});
