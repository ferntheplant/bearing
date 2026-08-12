import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { applyTriage, planTriage, type TriageVerdict } from "#src/triage.ts";

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

const CAPTURED = "# Captured\n\nBacklog body.\n";

const entries = (overrides: Readonly<Record<string, FsEntry>>): Readonly<Record<string, FsEntry>> => ({
  [`${TRACKER}/backlog`]: directory(),
  [`${TRACKER}/tickets`]: directory(),
  [`${TRACKER}/maps`]: directory(),
  [`${TRACKER}/maps/mvp.md`]: file(VALID_MAP),
  [`${TRACKER}/backlog/c1d2e3-captured.md`]: file(CAPTURED),
  ...overrides,
});

const runPlan = (files: Readonly<Record<string, FsEntry>>, prefix: string, verdict: TriageVerdict) => {
  const harness = new Harness(files);
  return Effect.runPromise(Effect.provide(planTriage(`${WORKSPACE}/nested`, prefix, verdict), layer(harness)));
};

describe("planTriage", () => {
  it("plans --ticket as a projectless build ticket with the id and slug unchanged and the body carried over", async () => {
    const plan = await runPlan(entries({}), "c1d2e3", { kind: "ticket" });

    expect(plan).toEqual({
      kind: "promote",
      id: "c1d2e3",
      slug: "captured",
      from: `${TRACKER}/backlog/c1d2e3-captured.md`,
      to: `${TRACKER}/tickets/c1d2e3-captured.md`,
      project: undefined,
      source: `---
type: build
---

${CAPTURED}`,
    });
  });

  it("plans --to <project> as a build ticket in the named map, body untouched", async () => {
    const plan = await runPlan(entries({}), "c1d2e3", { kind: "project", project: "mvp" });

    expect(plan).toEqual({
      kind: "promote",
      id: "c1d2e3",
      slug: "captured",
      from: `${TRACKER}/backlog/c1d2e3-captured.md`,
      to: `${TRACKER}/tickets/c1d2e3-captured.md`,
      project: "mvp",
      source: `---
type: build
project: mvp
---

${CAPTURED}`,
    });
  });

  it("plans --drop as the deletion of the backlog item and nothing else", async () => {
    await expect(runPlan(entries({}), "c1d2e3", { kind: "drop" })).resolves.toEqual({
      kind: "drop",
      id: "c1d2e3",
      slug: "captured",
      from: `${TRACKER}/backlog/c1d2e3-captured.md`,
    });
  });

  it("resolves an unambiguous prefix", async () => {
    const plan = await runPlan(entries({}), "c1d", { kind: "ticket" });

    expect(plan).toMatchObject({ kind: "promote", id: "c1d2e3" });
  });

  it("refuses a prefix that resolves to a ticket rather than a backlog item", async () => {
    const files = entries({ [`${TRACKER}/tickets/a1b2c3-first.md`]: file("---\ntype: build\n---\n\nBody.\n") });

    await expect(runPlan(files, "a1b2c3", { kind: "ticket" })).rejects.toMatchObject({
      _tag: "TriageError",
      reason: "ticket-item",
    });
  });

  it("refuses --to naming a map no file carries, naming the maps that exist", async () => {
    await expect(runPlan(entries({}), "c1d2e3", { kind: "project", project: "missing" })).rejects.toMatchObject({
      _tag: "TriageError",
      reason: "project-missing",
      project: "missing",
      projects: ["mvp"],
    });
  });

  it("refuses a prefix matching nothing", async () => {
    await expect(runPlan(entries({}), "zzzz", { kind: "ticket" })).rejects.toMatchObject({
      _tag: "TriageError",
      reason: "no-match",
    });
  });

  it("refuses an ambiguous prefix, naming the candidates", async () => {
    const files = entries({
      [`${TRACKER}/backlog/c3d4e5-one.md`]: file("# One\n"),
      [`${TRACKER}/backlog/c4d5e6-two.md`]: file("# Two\n"),
    });

    await expect(runPlan(files, "c", { kind: "ticket" })).rejects.toMatchObject({
      _tag: "TriageError",
      reason: "ambiguous",
      candidates: ["c1d2e3", "c3d4e5", "c4d5e6"],
    });
  });

  it("serializes a project that resembles another scalar as a YAML string", async () => {
    const files = entries({
      [`${TRACKER}/maps/null.md`]: file(VALID_MAP.replace("# MVP", "# Null")),
    });

    const plan = await runPlan(files, "c1d2e3", { kind: "project", project: "null" });

    expect(plan).toMatchObject({
      kind: "promote",
      project: "null",
      source: `---
type: build
project: "null"
---

${CAPTURED}`,
    });
  });

  it("refuses a malformed tracker rather than planning against it", async () => {
    const files = entries({ [`${TRACKER}/tickets/bad.md`]: file("no frontmatter\n") });

    await expect(runPlan(files, "c1d2e3", { kind: "ticket" })).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
    });
  });
});

describe("applyTriage", () => {
  it("writes the promoted ticket before unlinking the backlog item", async () => {
    const harness = new Harness(entries({}));
    const plan = await Effect.runPromise(
      Effect.provide(planTriage(`${WORKSPACE}/nested`, "c1d2e3", { kind: "ticket" }), layer(harness)),
    );

    const result = await Effect.runPromise(Effect.provide(applyTriage(plan), layer(harness)));

    expect(result).toEqual({
      id: "c1d2e3",
      slug: "captured",
      verdict: "ticket",
      from: `${TRACKER}/backlog/c1d2e3-captured.md`,
      to: `${TRACKER}/tickets/c1d2e3-captured.md`,
    });
    expect(harness.entries.get(`${TRACKER}/backlog/c1d2e3-captured.md`)).toBeUndefined();
    expect(harness.entries.get(`${TRACKER}/tickets/c1d2e3-captured.md`)).toEqual(
      file(`---
type: build
---

${CAPTURED}`),
    );
  });

  it("carries the project into the apply result for --to", async () => {
    const harness = new Harness(entries({}));
    const plan = await Effect.runPromise(
      Effect.provide(planTriage(`${WORKSPACE}/nested`, "c1d2e3", { kind: "project", project: "mvp" }), layer(harness)),
    );

    const result = await Effect.runPromise(Effect.provide(applyTriage(plan), layer(harness)));

    expect(result).toMatchObject({ verdict: "project", project: "mvp", to: `${TRACKER}/tickets/c1d2e3-captured.md` });
  });

  it("deletes the backlog item for --drop", async () => {
    const harness = new Harness(entries({}));
    const plan = await Effect.runPromise(
      Effect.provide(planTriage(`${WORKSPACE}/nested`, "c1d2e3", { kind: "drop" }), layer(harness)),
    );

    const result = await Effect.runPromise(Effect.provide(applyTriage(plan), layer(harness)));

    expect(result).toEqual({
      id: "c1d2e3",
      slug: "captured",
      verdict: "drop",
      from: `${TRACKER}/backlog/c1d2e3-captured.md`,
    });
    expect(harness.entries.get(`${TRACKER}/backlog/c1d2e3-captured.md`)).toBeUndefined();
  });

  it("leaves the backlog item alone when writing the ticket fails, so nothing disappears", async () => {
    const harness = new Harness(entries({}), {
      operation: "write-file",
      path: `${TRACKER}/tickets/c1d2e3-captured.md`,
    });
    const plan = await Effect.runPromise(
      Effect.provide(planTriage(`${WORKSPACE}/nested`, "c1d2e3", { kind: "ticket" }), layer(harness)),
    );

    await expect(Effect.runPromise(Effect.provide(applyTriage(plan), layer(harness)))).rejects.toMatchObject({
      _tag: "TriageApplyError",
      operation: "write-file",
      path: `${TRACKER}/tickets/c1d2e3-captured.md`,
    });
    expect(harness.entries.get(`${TRACKER}/backlog/c1d2e3-captured.md`)).toEqual(file(CAPTURED));
    expect(harness.entries.get(`${TRACKER}/tickets/c1d2e3-captured.md`)).toBeUndefined();
  });

  it("leaves both files when unlinking the backlog fails, so an interrupted triage is a duplicate id", async () => {
    const harness = new Harness(entries({}), {
      operation: "remove",
      path: `${TRACKER}/backlog/c1d2e3-captured.md`,
    });
    const plan = await Effect.runPromise(
      Effect.provide(planTriage(`${WORKSPACE}/nested`, "c1d2e3", { kind: "ticket" }), layer(harness)),
    );

    await expect(Effect.runPromise(Effect.provide(applyTriage(plan), layer(harness)))).rejects.toMatchObject({
      _tag: "TriageApplyError",
      operation: "remove",
      path: `${TRACKER}/backlog/c1d2e3-captured.md`,
    });
    expect(harness.entries.get(`${TRACKER}/backlog/c1d2e3-captured.md`)).toEqual(file(CAPTURED));
    expect(harness.entries.get(`${TRACKER}/tickets/c1d2e3-captured.md`)).toEqual(
      file(`---
type: build
---

${CAPTURED}`),
    );
  });

  it("reports a removal failure as a TriageApplyError", async () => {
    const harness = new Harness(entries({}), {
      operation: "remove",
      path: `${TRACKER}/backlog/c1d2e3-captured.md`,
    });
    const plan = await Effect.runPromise(
      Effect.provide(planTriage(`${WORKSPACE}/nested`, "c1d2e3", { kind: "drop" }), layer(harness)),
    );

    await expect(Effect.runPromise(Effect.provide(applyTriage(plan), layer(harness)))).rejects.toMatchObject({
      _tag: "TriageApplyError",
      operation: "remove",
      path: `${TRACKER}/backlog/c1d2e3-captured.md`,
    });
  });
});
