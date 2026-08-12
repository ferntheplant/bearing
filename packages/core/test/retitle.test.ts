import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { applyRetitle, planRetitle } from "#src/retitle.ts";

import { directory, file, Harness, layer, type FsEntry } from "./fs-harness.ts";

const WORKSPACE = "/workspace";
const TRACKER = `${WORKSPACE}/.bearing`;
const SOURCE = "---\r\ntype: build\r\nproject: mvp\r\n---\r\n\r\n# Original title\r\n\r\nBody.\r\n";

const entries = (overrides: Readonly<Record<string, FsEntry>> = {}): Readonly<Record<string, FsEntry>> => ({
  [`${TRACKER}/backlog`]: directory(),
  [`${TRACKER}/tickets`]: directory(),
  [`${TRACKER}/maps`]: directory(),
  [`${TRACKER}/tickets/a1b2c3-original-title.md`]: file(SOURCE),
  ...overrides,
});

const runPlan = (files: Readonly<Record<string, FsEntry>>, prefix: string, title: string) => {
  const harness = new Harness(files);
  return Effect.runPromise(Effect.provide(planRetitle(`${WORKSPACE}/nested`, prefix, title), layer(harness)));
};

describe("planRetitle", () => {
  it("resolves a ticket prefix and plans writing the byte-identical source before removing the old path", async () => {
    const plan = await runPlan(entries(), "a1b", "A better title");

    expect(plan).toEqual({
      id: "a1b2c3",
      slug: "a-better-title",
      from: `${TRACKER}/tickets/a1b2c3-original-title.md`,
      to: `${TRACKER}/tickets/a1b2c3-a-better-title.md`,
      edits: [
        {
          operation: "write-file",
          path: `${TRACKER}/tickets/a1b2c3-a-better-title.md`,
          source: SOURCE,
        },
        { operation: "remove", path: `${TRACKER}/tickets/a1b2c3-original-title.md` },
      ],
    });
  });

  it("plans no edits when the new title derives the current slug", async () => {
    await expect(runPlan(entries(), "a1b2c3", "Original title!")).resolves.toMatchObject({
      slug: "original-title",
      edits: [],
    });
  });

  it("refuses a prefix matching no item", async () => {
    await expect(runPlan(entries(), "zzzz", "New title")).rejects.toMatchObject({
      _tag: "RetitleError",
      reason: "no-match",
      prefix: "zzzz",
    });
  });

  it("refuses an ambiguous prefix and names every candidate", async () => {
    const files = entries({
      [`${TRACKER}/tickets/a2b3c4-other.md`]: file("---\ntype: build\n---\n\nOther.\n"),
    });

    await expect(runPlan(files, "a", "New title")).rejects.toMatchObject({
      _tag: "RetitleError",
      reason: "ambiguous",
      candidates: ["a1b2c3", "a2b3c4"],
    });
  });

  it("refuses a backlog item", async () => {
    const files = entries({ [`${TRACKER}/backlog/c1d2e3-captured.md`]: file("# Captured\n") });

    await expect(runPlan(files, "c1d2e3", "New title")).rejects.toMatchObject({
      _tag: "RetitleError",
      reason: "backlog-item",
      prefix: "c1d2e3",
    });
  });
});

describe("applyRetitle", () => {
  const PLAN = {
    id: "a1b2c3",
    slug: "a-better-title",
    from: `${TRACKER}/tickets/a1b2c3-original-title.md`,
    to: `${TRACKER}/tickets/a1b2c3-a-better-title.md`,
    edits: [
      { operation: "write-file" as const, path: `${TRACKER}/tickets/a1b2c3-a-better-title.md`, source: SOURCE },
      { operation: "remove" as const, path: `${TRACKER}/tickets/a1b2c3-original-title.md` },
    ],
  };

  it("writes the new path before removing the old one", async () => {
    const harness = new Harness(entries());

    await expect(Effect.runPromise(Effect.provide(applyRetitle(PLAN), layer(harness)))).resolves.toEqual({
      id: "a1b2c3",
      slug: "a-better-title",
      from: PLAN.from,
      to: PLAN.to,
      changed: true,
    });
    expect(harness.entries.get(PLAN.to)).toEqual(file(SOURCE));
    expect(harness.entries.has(PLAN.from)).toBe(false);
  });

  it("leaves both byte-identical files when removing the old path fails after the write", async () => {
    const harness = new Harness(entries(), { operation: "remove", path: PLAN.from });

    await expect(Effect.runPromise(Effect.provide(applyRetitle(PLAN), layer(harness)))).rejects.toMatchObject({
      _tag: "RetitleApplyError",
      operation: "remove",
      path: PLAN.from,
    });
    expect(harness.entries.get(PLAN.from)).toEqual(file(SOURCE));
    expect(harness.entries.get(PLAN.to)).toEqual(file(SOURCE));
  });

  it("does not overwrite an existing destination", async () => {
    const harness = new Harness(entries({ [PLAN.to]: file("Existing.\n") }));

    await expect(Effect.runPromise(Effect.provide(applyRetitle(PLAN), layer(harness)))).rejects.toMatchObject({
      _tag: "RetitleApplyError",
      operation: "write-file",
      path: PLAN.to,
    });
    expect(harness.entries.get(PLAN.from)).toEqual(file(SOURCE));
    expect(harness.entries.get(PLAN.to)).toEqual(file("Existing.\n"));
  });

  it("applies a no-op successfully without touching the file", async () => {
    const plan = { ...PLAN, slug: "original-title", to: PLAN.from, edits: [] };
    const harness = new Harness(entries());

    await expect(Effect.runPromise(Effect.provide(applyRetitle(plan), layer(harness)))).resolves.toMatchObject({
      changed: false,
      from: PLAN.from,
      to: PLAN.from,
    });
    expect(harness.entries.get(PLAN.from)).toEqual(file(SOURCE));
  });
});
