import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { checkTracker } from "#src/check.ts";

import { directory, file, Harness, layer, link, type FsEntry } from "./fs-harness.ts";

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

const ticketSource = (
  type: "design" | "build",
  { project, blockers }: { readonly project?: string; readonly blockers?: readonly string[] } = {},
) => `---
type: ${type}
${project === undefined ? "" : `project: ${project}\n`}${blockers === undefined ? "" : `blockers: [${blockers.join(", ")}]\n`}---
`;

const entries = (extra: Readonly<Record<string, FsEntry>> = {}) => ({
  [`${TRACKER}/backlog`]: directory(),
  [`${TRACKER}/tickets`]: directory(),
  [`${TRACKER}/maps`]: directory(),
  [`${TRACKER}/maps/mvp.md`]: file(VALID_MAP),
  ...extra,
});

const runCheck = (all: Readonly<Record<string, FsEntry>>) => {
  const harness = new Harness(all);
  return Effect.runPromise(Effect.provide(checkTracker(`${WORKSPACE}/nested`), layer(harness)));
};

describe("checkTracker", () => {
  it("reports nothing for a clean tracker", async () => {
    const result = await runCheck(entries());

    expect(result.findings).toEqual([]);
  });

  it("reports every check it ran, in a fixed order, even when all of them pass", async () => {
    const result = await runCheck(entries());

    expect(result.checks.map((check) => check.name)).toEqual([
      "parse",
      "duplicate-id",
      "unknown-type",
      "design-no-project",
      "project-missing",
      "blocker-missing",
      "trail-row-open-ticket",
    ]);
    expect(result.checks.every((check) => check.findings.length === 0)).toBe(true);
  });

  it("files a finding under the check that produced it and leaves the rest passing", async () => {
    const result = await runCheck(
      entries({ [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("build", { blockers: ["zzzzzz"] })) }),
    );

    const failed = result.checks.filter((check) => check.findings.length > 0);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.name).toBe("blocker-missing");
    expect(failed[0]?.severity).toBe("error");
    expect(failed[0]?.findings).toEqual(result.findings);
  });

  it("reports a ticket blocked by an id that does not exist", async () => {
    const result = await runCheck(
      entries({ [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("build", { blockers: ["zzzzzz"] })) }),
    );

    expect(result.findings).toContainEqual({
      severity: "error",
      kind: "blocker-missing",
      path: `${TRACKER}/tickets/a1b2c3-first.md`,
      owner: "a1b2c3",
      blocker: "zzzzzz",
    });
  });

  it("reports a ticket naming a project no map carries", async () => {
    const result = await runCheck(
      entries({ [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("build", { project: "missing" })) }),
    );

    expect(result.findings).toContainEqual({
      severity: "error",
      kind: "project-missing",
      path: `${TRACKER}/tickets/a1b2c3-first.md`,
      owner: "a1b2c3",
      project: "missing",
    });
  });

  it("reports a design ticket with no project", async () => {
    const result = await runCheck(entries({ [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("design")) }));

    expect(result.findings).toContainEqual({
      severity: "error",
      kind: "design-no-project",
      path: `${TRACKER}/tickets/a1b2c3-first.md`,
      owner: "a1b2c3",
    });
  });

  it("reports an unknown type as one of the error classes", async () => {
    const result = await runCheck(
      entries({
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(
          ticketSource("design", { project: "mvp" }).replace("design", "frobnicate"),
        ),
      }),
    );

    expect(result.findings).toContainEqual({
      severity: "error",
      kind: "unknown-type",
      path: `${TRACKER}/tickets/a1b2c3-first.md`,
    });
  });

  it("reports two items sharing an id as a duplicate id", async () => {
    const result = await runCheck(
      entries({
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("build")),
        [`${TRACKER}/backlog/a1b2c3-captured.md`]: file("# Captured\n"),
      }),
    );

    expect(result.findings).toContainEqual({
      severity: "error",
      kind: "duplicate-id",
      id: "a1b2c3",
      paths: [`${TRACKER}/backlog/a1b2c3-captured.md`, `${TRACKER}/tickets/a1b2c3-first.md`],
    });
  });

  it("retains ids from malformed items for duplicate and blocker analysis", async () => {
    const result = await runCheck(
      entries({
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(
          ticketSource("design", { project: "mvp" }).replace("design", "frobnicate"),
        ),
        [`${TRACKER}/tickets/b1c2d3-second.md`]: file(ticketSource("build", { blockers: ["c1d2e3"] })),
        [`${TRACKER}/tickets/c1d2e3-third.md`]: file(ticketSource("build").replace("build", "frobnicate")),
        [`${TRACKER}/backlog/a1b2c3-captured.md`]: file("# Captured\n"),
      }),
    );

    expect(result.findings).toContainEqual({
      severity: "error",
      kind: "duplicate-id",
      id: "a1b2c3",
      paths: [`${TRACKER}/backlog/a1b2c3-captured.md`, `${TRACKER}/tickets/a1b2c3-first.md`],
    });
    expect(result.findings).not.toContainEqual(expect.objectContaining({ kind: "blocker-missing", blocker: "c1d2e3" }));
  });

  it("reports every parse failure and all five error classes in one run", async () => {
    const result = await runCheck(
      entries({
        [`${TRACKER}/tickets/bad.md`]: file("no frontmatter\n"),
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("build", { blockers: ["zzzzzz"] })),
        [`${TRACKER}/tickets/b1c2d3-second.md`]: file(ticketSource("build", { project: "missing" })),
        [`${TRACKER}/tickets/c1d2e3-third.md`]: file(ticketSource("design")),
        [`${TRACKER}/tickets/d1e2f3-fourth.md`]: file(
          ticketSource("design", { project: "mvp" }).replace("design", "frobnicate"),
        ),
        [`${TRACKER}/tickets/e1f2g3-fifth.md`]: file(ticketSource("build")),
        [`${TRACKER}/backlog/e1f2g3-captured.md`]: file("# Captured\n"),
      }),
    );

    expect(result.findings.map((finding) => finding.kind).sort()).toEqual([
      "blocker-missing",
      "design-no-project",
      "duplicate-id",
      "parse",
      "parse",
      "project-missing",
      "unknown-type",
    ]);
  });

  it("reports a trail row naming a ticket that still exists as the one warning, naming the fix command", async () => {
    const mapWithRow = VALID_MAP.replace(
      "## Trail\n\n",
      "## Trail\n\n| id | Decision | Outcome |\n| --- | --- | --- |\n| a1b2c3 | Some decision | [row](outcome) |\n\n",
    );
    const result = await runCheck(
      entries({
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("design", { project: "mvp" })),
        [`${TRACKER}/maps/mvp.md`]: file(mapWithRow),
      }),
    );

    expect(result.findings).toEqual([
      {
        severity: "warning",
        kind: "trail-row-open-ticket",
        path: `${TRACKER}/maps/mvp.md`,
        id: "a1b2c3",
      },
    ]);
  });

  it("does not warn when the trail row names a ticket that no longer exists", async () => {
    const mapWithRow = VALID_MAP.replace(
      "## Trail\n\n",
      "## Trail\n\n| id | Decision | Outcome |\n| --- | --- | --- |\n| kwjvxc | Some decision | [row](outcome) |\n\n",
    );
    const result = await runCheck(entries({ [`${TRACKER}/maps/mvp.md`]: file(mapWithRow) }));

    expect(result.findings).toEqual([]);
  });

  it("does not parse trail outcome prose or follow links inside it", async () => {
    const mapWithRow = VALID_MAP.replace(
      "## Trail\n\n",
      "## Trail\n\n| id | Decision | Outcome |\n| --- | --- | --- |\n| kwjvxc | Some decision | [a1b2c3](tickets/a1b2c3-first.md) |\n\n",
    );
    const result = await runCheck(
      entries({
        [`${TRACKER}/tickets/a1b2c3-first.md`]: file(ticketSource("build")),
        [`${TRACKER}/maps/mvp.md`]: file(mapWithRow),
      }),
    );

    expect(result.findings).toEqual([]);
  });

  it("refuses a nearest .bearing symlink rather than searching farther upward", async () => {
    const harness = new Harness({ [`${WORKSPACE}/.bearing`]: link("/elsewhere") });
    await expect(
      Effect.runPromise(Effect.provide(checkTracker(`${WORKSPACE}/nested`), layer(harness))),
    ).rejects.toMatchObject({ _tag: "MalformedTrackerError" });
  });

  it("reports a missing directory as a structure error rather than refusing", async () => {
    const harness = new Harness({ [`${TRACKER}/tickets`]: directory(), [`${TRACKER}/maps`]: directory() });
    const result = await Effect.runPromise(Effect.provide(checkTracker(`${WORKSPACE}/nested`), layer(harness)));

    expect(
      result.findings.some(
        (finding) => finding.kind === "parse" && finding.detail.includes("backlog directory is missing"),
      ),
    ).toBe(true);
  });
});
