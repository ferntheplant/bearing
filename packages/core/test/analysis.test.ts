import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { listTickets, resolveId, showItem, type TicketSelector } from "#src/analysis.ts";

const TRACKER = "/workspace/.bearing";
const VALID_MAP = `# MVP

## Destination

Ship bearing.

## Notes

## Trail

## Not yet committed

### Ship a reader

## Not yet specified

### Reader depth

## Out of scope
`;

const TICKETS = {
  "a1b2c3-first.md": `---
type: design
project: mvp
---

# This body is opaque
`,
  "a2b3c4-third.md": `---
type: build
---

Third.
`,
  "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Body.
`,
};

const BACKLOG = {
  "c1d2e3-captured.md": "# Captured idea\n\nLong prose.\n",
};

interface Fixture {
  readonly backlog: Record<string, string>;
  readonly tickets: Record<string, string>;
  readonly maps: Record<string, string>;
}

const fixture = (overrides: Partial<Fixture> = {}): Fixture => ({
  backlog: BACKLOG,
  tickets: TICKETS,
  maps: { "mvp.md": VALID_MAP },
  ...overrides,
});

const directoryInfo = { type: "Directory" } as FileSystem.File.Info;
const fileInfo = { type: "File" } as FileSystem.File.Info;

const layer = (files: Fixture) =>
  Layer.merge(
    FileSystem.layerNoop({
      exists: (path) => Effect.succeed(path === TRACKER),
      stat: (path) =>
        Effect.succeed(
          path === TRACKER || ["backlog", "tickets", "maps"].some((directory) => path === `${TRACKER}/${directory}`)
            ? directoryInfo
            : fileInfo,
        ),
      readDirectory: (path) => {
        const directory = path.split("/").at(-1) as keyof Fixture;
        return Effect.succeed(Object.keys(files[directory]));
      },
      readFileString: (path) => {
        const parts = path.split("/");
        const filename = parts.at(-1) ?? "";
        const directory = parts.at(-2) as keyof Fixture;
        return Effect.succeed(files[directory][filename] ?? "");
      },
    }),
    Path.layer,
  );

const runResolve = (files: Fixture, prefix: string) =>
  Effect.runPromise(Effect.provide(resolveId("/workspace/nested", prefix), layer(files)));

const runShow = (files: Fixture, prefix: string) =>
  Effect.runPromise(Effect.provide(showItem("/workspace/nested", prefix), layer(files)));

describe("resolveId", () => {
  it("resolves a full six-character id to its ticket", async () => {
    const result = await runResolve(fixture(), "a1b2c3");

    expect(result).toEqual({
      tag: "match",
      item: {
        kind: "ticket",
        id: "a1b2c3",
        slug: "first",
        path: `${TRACKER}/tickets/a1b2c3-first.md`,
      },
    });
  });

  it("resolves an unambiguous prefix of a ticket id", async () => {
    const result = await runResolve(fixture(), "b1c2");

    expect(result).toEqual({
      tag: "match",
      item: {
        kind: "ticket",
        id: "b1c2d3",
        slug: "second",
        path: `${TRACKER}/tickets/b1c2d3-second.md`,
      },
    });
  });

  it("resolves a backlog item across the whole tracker", async () => {
    const result = await runResolve(fixture(), "c1d2e3");

    expect(result).toEqual({
      tag: "match",
      item: {
        kind: "backlog",
        id: "c1d2e3",
        slug: "captured",
        path: `${TRACKER}/backlog/c1d2e3-captured.md`,
      },
    });
  });

  it("returns every candidate id for an ambiguous prefix", async () => {
    const result = await runResolve(fixture(), "a");

    expect(result).toEqual({
      tag: "ambiguous",
      prefix: "a",
      candidates: [
        { kind: "ticket", id: "a1b2c3", slug: "first", path: `${TRACKER}/tickets/a1b2c3-first.md` },
        { kind: "ticket", id: "a2b3c4", slug: "third", path: `${TRACKER}/tickets/a2b3c4-third.md` },
      ],
    });
  });

  it("returns a distinguishable no-match refusal", async () => {
    const result = await runResolve(fixture(), "zzzz");

    expect(result).toEqual({ tag: "no-match", prefix: "zzzz" });
  });

  it("reports two items sharing an id as ambiguous rather than choosing one", async () => {
    const files = fixture({
      backlog: { ...BACKLOG, "a1b2c3-duplicate.md": "# Duplicate\n" },
    });

    const result = await runResolve(files, "a1b2c3");

    expect(result).toEqual({
      tag: "ambiguous",
      prefix: "a1b2c3",
      candidates: [
        { kind: "backlog", id: "a1b2c3", slug: "duplicate", path: `${TRACKER}/backlog/a1b2c3-duplicate.md` },
        { kind: "ticket", id: "a1b2c3", slug: "first", path: `${TRACKER}/tickets/a1b2c3-first.md` },
      ],
    });
  });

  it("refuses a malformed tracker rather than resolving against it", async () => {
    const files = fixture({
      tickets: { ...TICKETS, "bad.md": "no frontmatter\n" },
    });

    await expect(runResolve(files, "a1b2c3")).rejects.toMatchObject({ _tag: "MalformedTrackerError" });
  });
});

describe("showItem", () => {
  it("returns a ticket's frontmatter fields, body, and exact source", async () => {
    const result = await runShow(fixture(), "a1b2c3");

    expect(result).toEqual({
      tag: "resolved",
      item: {
        kind: "ticket",
        id: "a1b2c3",
        slug: "first",
        type: "design",
        project: "mvp",
        blockers: [],
        body: "# This body is opaque",
        source: TICKETS["a1b2c3-first.md"],
      },
    });
  });

  it("returns a backlog item as the same kind of value", async () => {
    const result = await runShow(fixture(), "c1d2e3");

    expect(result).toEqual({
      tag: "resolved",
      item: {
        kind: "backlog",
        id: "c1d2e3",
        slug: "captured",
        body: "# Captured idea\n\nLong prose.",
        source: BACKLOG["c1d2e3-captured.md"],
      },
    });
  });

  it("returns a no-match refusal", async () => {
    const result = await runShow(fixture(), "zzzz");

    expect(result).toEqual({ tag: "no-match", prefix: "zzzz" });
  });

  it("returns an ambiguous refusal carrying the candidates", async () => {
    const files = fixture({
      backlog: { ...BACKLOG, "a1b2c3-duplicate.md": "# Duplicate\n" },
    });

    const result = await runShow(files, "a1b2");

    expect(result).toEqual({
      tag: "ambiguous",
      prefix: "a1b2",
      candidates: [
        { kind: "backlog", id: "a1b2c3", slug: "duplicate", path: `${TRACKER}/backlog/a1b2c3-duplicate.md` },
        { kind: "ticket", id: "a1b2c3", slug: "first", path: `${TRACKER}/tickets/a1b2c3-first.md` },
      ],
    });
  });

  it("resolves against the nearest ancestor tracker from a nested directory", async () => {
    const files = fixture({
      backlog: { "c1d2e3-captured.md": "# Nested\n" },
    });

    const result = await Effect.runPromise(
      Effect.provide(showItem("/workspace/nested/deep/down", "c1d2e3"), layer(files)),
    );

    expect(result).toEqual({
      tag: "resolved",
      item: { kind: "backlog", id: "c1d2e3", slug: "captured", body: "# Nested", source: "# Nested\n" },
    });
  });
});

const ticketSource = (
  type: "design" | "build",
  { project, blockers }: { readonly project?: string; readonly blockers?: readonly string[] } = {},
) => `---
type: ${type}
${project === undefined ? "" : `project: ${project}\n`}${blockers === undefined ? "" : `blockers: [${blockers.join(", ")}]\n`}---
`;

const runList = (files: Fixture, selector: TicketSelector = {}) =>
  Effect.runPromise(Effect.provide(listTickets("/workspace/nested", selector), layer(files)));

const listedIds = (result: Awaited<ReturnType<typeof runList>>): readonly string[] => {
  expect(result.tag).toBe("ok");
  if (result.tag !== "ok") {
    return [];
  }
  return result.tickets.map((ticket) => ticket.id);
};

describe("listTickets", () => {
  it("marks a ticket naming only absorbed blockers as ready, not blocked", async () => {
    const files = fixture({
      tickets: { ...TICKETS, "b1c2d3-second.md": ticketSource("build", { blockers: ["zzzzzz"] }) },
    });

    const result = await runList(files);
    expect(result).toEqual({
      tag: "ok",
      tickets: expect.arrayContaining([
        {
          id: "b1c2d3",
          slug: "second",
          type: "build",
          project: undefined,
          blockers: ["zzzzzz"],
          ready: true,
          blockedBy: [],
          unblocks: [],
        },
      ]),
    });
  });

  it("derives the transitive closure both ways through a chain", async () => {
    const files = fixture({
      tickets: {
        ...TICKETS,
        "a2b3c4-third.md": ticketSource("build", { blockers: ["b1c2d3"] }),
      },
    });

    const result = await runList(files);
    expect(result).toEqual({
      tag: "ok",
      tickets: [
        {
          id: "a1b2c3",
          slug: "first",
          type: "design",
          project: "mvp",
          blockers: [],
          ready: true,
          blockedBy: [],
          unblocks: ["b1c2d3", "a2b3c4"],
        },
        {
          id: "a2b3c4",
          slug: "third",
          type: "build",
          project: undefined,
          blockers: ["b1c2d3"],
          ready: false,
          blockedBy: ["b1c2d3", "a1b2c3"],
          unblocks: [],
        },
        {
          id: "b1c2d3",
          slug: "second",
          type: "build",
          project: undefined,
          blockers: ["a1b2c3"],
          ready: false,
          blockedBy: ["a1b2c3"],
          unblocks: ["a2b3c4"],
        },
      ],
    });
  });

  it("reports a blocker cycle as a refusal naming the ids in it", async () => {
    const files = fixture({
      tickets: {
        "a1b2c3-first.md": ticketSource("design", { project: "mvp", blockers: ["b1c2d3"] }),
        "b1c2d3-second.md": ticketSource("build", { blockers: ["a1b2c3"] }),
      },
    });

    const result = await runList(files);

    expect(result).toEqual({ tag: "cycle", ids: ["a1b2c3", "b1c2d3"] });
  });

  it("reports a blocker cycle deeper than the runtime call stack", async () => {
    const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
    const ids = Array.from({ length: 60_000 }, (_, index) => {
      let value = index;
      let suffix = "";
      for (let position = 0; position < 5; position++) {
        suffix = `${alphabet[value % alphabet.length] as string}${suffix}`;
        value = Math.floor(value / alphabet.length);
      }
      return `a${suffix}`;
    });
    const tickets = Object.fromEntries(
      ids.map((id, index) => [
        `${id}-ticket.md`,
        ticketSource("build", { blockers: [ids[(index + 1) % ids.length] as string] }),
      ]),
    );

    const result = await runList(fixture({ tickets }));

    expect(result.tag).toBe("cycle");
    if (result.tag !== "cycle") {
      return;
    }
    expect(result.ids).toHaveLength(ids.length);
    expect(result.ids[0]).toBe(ids[0]);
    expect(result.ids.at(-1)).toBe(ids.at(-1));
  });

  it("filters by type, intersecting when several flags are combined", async () => {
    expect(listedIds(await runList(fixture(), { types: ["build"] }))).toEqual(["a2b3c4", "b1c2d3"]);
    expect(listedIds(await runList(fixture(), { types: ["design"] }))).toEqual(["a1b2c3"]);
    expect(listedIds(await runList(fixture(), { types: ["build", "design"] }))).toEqual([]);
    expect(listedIds(await runList(fixture(), { types: [] }))).toEqual([]);
  });

  it("filters by readiness", async () => {
    expect(listedIds(await runList(fixture(), { readiness: ["ready"] }))).toEqual(["a1b2c3", "a2b3c4"]);
    expect(listedIds(await runList(fixture(), { readiness: ["blocked"] }))).toEqual(["b1c2d3"]);
    expect(listedIds(await runList(fixture(), { readiness: ["ready", "blocked"] }))).toEqual([]);
    expect(listedIds(await runList(fixture(), { readiness: [] }))).toEqual([]);
  });

  it("filters by project and intersects with other filters", async () => {
    expect(listedIds(await runList(fixture(), { project: "mvp" }))).toEqual(["a1b2c3"]);
    expect(listedIds(await runList(fixture(), { types: ["design"], readiness: ["ready"], project: "mvp" }))).toEqual([
      "a1b2c3",
    ]);
  });

  it("refuses a project no map carries, naming the maps that exist", async () => {
    const result = await runList(fixture(), { project: "missing" });

    expect(result).toEqual({ tag: "no-project", project: "missing", projects: ["mvp"] });
  });

  it("refuses a malformed tracker rather than deriving against it", async () => {
    const files = fixture({
      tickets: { ...TICKETS, "bad.md": "no frontmatter\n" },
    });

    await expect(runList(files)).rejects.toMatchObject({ _tag: "MalformedTrackerError" });
  });
});
