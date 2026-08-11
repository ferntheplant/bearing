import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { applyRemoval, planClose, planRemove } from "#src/remove.ts";

import { directory, file, Harness, layer, type FsEntry } from "./fs-harness.ts";

const WORKSPACE = "/workspace";
const TRACKER = `${WORKSPACE}/.bearing`;

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

const ticket = (
  type: "build" | "design",
  slug: string,
  blockers: readonly string[] = [],
  project: boolean = type === "design",
) => `---
type: ${type}
${project ? "project: mvp\n" : ""}${blockers.length === 0 ? "" : `blockers: [${blockers.join(", ")}]\n`}---

${slug} body.
`;

const entries = (overrides: Readonly<Record<string, FsEntry>>): Readonly<Record<string, FsEntry>> => ({
  [`${TRACKER}/backlog`]: directory(),
  [`${TRACKER}/tickets`]: directory(),
  [`${TRACKER}/maps`]: directory(),
  [`${TRACKER}/maps/mvp.md`]: file(VALID_MAP),
  ...overrides,
});

const runPlan = (files: Readonly<Record<string, FsEntry>>, prefix: string, mode: "close" | "remove") => {
  const harness = new Harness(files);
  const effect =
    mode === "close" ? planClose(`${WORKSPACE}/nested`, prefix) : planRemove(`${WORKSPACE}/nested`, prefix);
  return Effect.runPromise(Effect.provide(effect, layer(harness)));
};

describe("planClose", () => {
  it("plans deleting a build ticket and stripping its id from every ticket that names it", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
      [`${TRACKER}/tickets/b1c2d3-second.md`]: file(ticket("build", "second", ["a1b2c3"])),
      [`${TRACKER}/tickets/c1d2e3-third.md`]: file(ticket("design", "third", ["a1b2c3", "b1c2d3"])),
    });

    const plan = await runPlan(files, "a1b2c3", "close");

    expect(plan.target).toEqual({
      kind: "ticket",
      id: "a1b2c3",
      slug: "first",
      path: `${TRACKER}/tickets/a1b2c3-first.md`,
    });
    expect(plan.rewrites).toEqual([
      {
        path: `${TRACKER}/tickets/b1c2d3-second.md`,
        source: `---
type: build
---

second body.
`,
      },
      {
        path: `${TRACKER}/tickets/c1d2e3-third.md`,
        source: `---
type: design
project: mvp
blockers: [b1c2d3]
---

third body.
`,
      },
    ]);
  });

  it("refuses a design ticket instead of falling through to the build close", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("design", "first")),
    });

    await expect(runPlan(files, "a1b2c3", "close")).rejects.toMatchObject({
      _tag: "RemovalError",
      reason: "design-ticket",
    });
  });

  it("refuses a backlog item, pointing at bearing rm", async () => {
    const files = entries({
      [`${TRACKER}/backlog/c1d2e3-captured.md`]: file("# Captured\n"),
    });

    await expect(runPlan(files, "c1d2e3", "close")).rejects.toMatchObject({
      _tag: "RemovalError",
      reason: "backlog-item",
    });
  });

  it("refuses a prefix matching nothing", async () => {
    await expect(runPlan(entries({}), "zzzz", "close")).rejects.toMatchObject({
      _tag: "RemovalError",
      reason: "no-match",
    });
  });

  it("refuses an ambiguous prefix, naming the candidates", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-one.md`]: file(ticket("build", "one")),
      [`${TRACKER}/tickets/a2b3c4-two.md`]: file(ticket("build", "two")),
    });

    await expect(runPlan(files, "a", "close")).rejects.toMatchObject({
      _tag: "RemovalError",
      reason: "ambiguous",
      candidates: ["a1b2c3", "a2b3c4"],
    });
  });

  it("preserves frontmatter key order when removing the emptied blockers key", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
      [`${TRACKER}/tickets/b1c2d3-second.md`]: file(
        `---
blockers: [a1b2c3]
type: build
---

Body.
`,
      ),
    });

    const plan = await runPlan(files, "a1b2c3", "close");

    expect(plan.rewrites).toEqual([
      {
        path: `${TRACKER}/tickets/b1c2d3-second.md`,
        source: `---
type: build
---

Body.
`,
      },
    ]);
  });
});

describe("planRemove", () => {
  it("plans deleting a backlog item with no close semantics", async () => {
    const files = entries({
      [`${TRACKER}/backlog/c1d2e3-captured.md`]: file("# Captured\n"),
    });

    const plan = await runPlan(files, "c1d2e3", "remove");

    expect(plan.target).toEqual({
      kind: "backlog",
      id: "c1d2e3",
      slug: "captured",
      path: `${TRACKER}/backlog/c1d2e3-captured.md`,
    });
    expect(plan.rewrites).toEqual([]);
  });

  it("plans deleting a design ticket, which close would refuse", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("design", "first")),
    });

    const plan = await runPlan(files, "a1b2c3", "remove");

    expect(plan.target.kind).toBe("ticket");
    expect(plan.rewrites).toEqual([]);
  });

  it("strips the removed id from tickets naming it, same as close", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
      [`${TRACKER}/tickets/b1c2d3-second.md`]: file(ticket("build", "second", ["a1b2c3"])),
    });

    const plan = await runPlan(files, "a1b2c3", "remove");

    expect(plan.rewrites).toEqual([
      {
        path: `${TRACKER}/tickets/b1c2d3-second.md`,
        source: `---
type: build
---

second body.
`,
      },
    ]);
  });
});

describe("stripBlockers rewrite losslessness", () => {
  it("rewrites a blocker list keeping every other byte of the file identical", async () => {
    const original = `---
type: design
project: mvp
blockers: [a1b2c3, b1c2d3]
---

# Question

Some body prose with **markdown** and a [link](https://example.com).
`;

    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
      [`${TRACKER}/tickets/b1c2d3-second.md`]: file(ticket("build", "second")),
      [`${TRACKER}/tickets/c1d2e3-third.md`]: file(original),
    });

    const plan = await runPlan(files, "a1b2c3", "close");
    const rewritten = plan.rewrites.find((rewrite) => rewrite.path === `${TRACKER}/tickets/c1d2e3-third.md`);

    expect(rewritten?.source).toBe(`---
type: design
project: mvp
blockers: [b1c2d3]
---

# Question

Some body prose with **markdown** and a [link](https://example.com).
`);
  });

  it("removes the blockers key entirely when the list becomes empty", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
      [`${TRACKER}/tickets/b1c2d3-second.md`]: file(`---
type: build
project: mvp
blockers: [a1b2c3]
---

Second.
`),
    });

    const plan = await runPlan(files, "a1b2c3", "close");
    const rewritten = plan.rewrites[0];

    expect(rewritten?.source).toBe(`---
type: build
project: mvp
---

Second.
`);
  });

  it("keeps CRLF line endings and other frontmatter bytes when stripping", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
      [`${TRACKER}/tickets/b1c2d3-second.md`]: file(
        "---\r\ntype: build\r\nproject: mvp\r\nblockers: [a1b2c3]\r\n---\r\n\r\nSecond.\r\n",
      ),
    });

    const plan = await runPlan(files, "a1b2c3", "close");
    const rewritten = plan.rewrites[0];

    expect(rewritten?.source).toBe("---\r\ntype: build\r\nproject: mvp\r\n---\r\n\r\nSecond.\r\n");
  });

  it("strips an id out of a block-style blocker list, keeping the survivors' exact lines", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
      [`${TRACKER}/tickets/b1c2d3-second.md`]: file(`---
type: build
blockers:
  - a1b2c3
  - c1d2e3
---

Second.
`),
    });

    const plan = await runPlan(files, "a1b2c3", "close");
    const rewritten = plan.rewrites[0];

    expect(rewritten?.source).toBe(`---
type: build
blockers:
  - c1d2e3
---

Second.
`);
  });
});

describe("applyRemoval", () => {
  it("deletes the target and writes every rewrite", async () => {
    const harness = new Harness(
      entries({
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
        [`${TRACKER}/tickets/b1c2d3-second.md`]: file(ticket("build", "second", ["a1b2c3"])),
      }),
    );
    const plan = await Effect.runPromise(Effect.provide(planClose(`${WORKSPACE}/nested`, "a1b2c3"), layer(harness)));

    const result = await Effect.runPromise(Effect.provide(applyRemoval(plan), layer(harness)));

    expect(result).toEqual({
      id: "a1b2c3",
      removed: `${TRACKER}/tickets/a1b2c3-first.md`,
      rewrote: [`${TRACKER}/tickets/b1c2d3-second.md`],
    });
    expect(harness.entries.get(`${TRACKER}/tickets/a1b2c3-first.md`)).toBeUndefined();
    expect(harness.entries.get(`${TRACKER}/tickets/b1c2d3-second.md`)).toEqual(
      file(`---
type: build
---

second body.
`),
    );
  });

  it("deletes the target before any rewrite, so an interrupted apply leaves dangling blockers", async () => {
    const harness = new Harness(
      entries({
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")),
        [`${TRACKER}/tickets/b1c2d3-second.md`]: file(ticket("build", "second", ["a1b2c3"])),
        [`${TRACKER}/tickets/c1d2e3-third.md`]: file(ticket("design", "third", ["a1b2c3"])),
      }),
      { operation: "write-file", path: `${TRACKER}/tickets/b1c2d3-second.md` },
    );
    const plan = await Effect.runPromise(Effect.provide(planClose(`${WORKSPACE}/nested`, "a1b2c3"), layer(harness)));

    await expect(Effect.runPromise(Effect.provide(applyRemoval(plan), layer(harness)))).rejects.toMatchObject({
      _tag: "RemovalApplyError",
      operation: "write-file",
      path: `${TRACKER}/tickets/b1c2d3-second.md`,
    });
    expect(harness.entries.get(`${TRACKER}/tickets/a1b2c3-first.md`)).toBeUndefined();
    expect(harness.entries.get(`${TRACKER}/tickets/b1c2d3-second.md`)).toEqual(
      file(ticket("build", "second", ["a1b2c3"])),
    );
  });

  it("reports a removal failure as a RemovalApplyError", async () => {
    const harness = new Harness(entries({ [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticket("build", "first")) }), {
      operation: "remove",
      path: `${TRACKER}/tickets/a1b2c3-first.md`,
    });
    const plan = await Effect.runPromise(Effect.provide(planClose(`${WORKSPACE}/nested`, "a1b2c3"), layer(harness)));

    await expect(Effect.runPromise(Effect.provide(applyRemoval(plan), layer(harness)))).rejects.toMatchObject({
      _tag: "RemovalApplyError",
      operation: "remove",
      path: `${TRACKER}/tickets/a1b2c3-first.md`,
    });
  });
});
