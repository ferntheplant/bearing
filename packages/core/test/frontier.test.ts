import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { deriveFrontier } from "#src/frontier.ts";

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

const NO_FOG_MAP = VALID_MAP.replace("### Reader depth\n\n", "");

const ticketSource = (
  type: "design" | "build",
  { project, blockers }: { readonly project?: string; readonly blockers?: readonly string[] } = {},
) => `---
type: ${type}
${project === undefined ? "" : `project: ${project}\n`}${blockers === undefined ? "" : `blockers: [${blockers.join(", ")}]\n`}---
`;

interface Fixture {
  readonly backlog: Record<string, string>;
  readonly tickets: Record<string, string>;
  readonly maps: Record<string, string>;
}

const fixture = (overrides: Partial<Fixture> = {}): Fixture => ({
  backlog: {},
  tickets: {},
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

const runFrontier = (files: Fixture) =>
  Effect.runPromise(Effect.provide(deriveFrontier("/workspace/nested"), layer(files)));

const frontierOf = async (files: Fixture) => {
  const result = await runFrontier(files);
  expect(result.tag).toBe("ok");
  if (result.tag !== "ok") {
    throw new Error("expected ok frontier");
  }
  return result.frontier;
};

describe("deriveFrontier", () => {
  it("lists ready build tickets before decide, and the backlog as a count", async () => {
    const files = fixture({
      backlog: { "c1d2e3-a.md": "# A\n", "c4d5e6-b.md": "# B\n" },
      tickets: {
        "a1b2c3-build.md": ticketSource("build", { project: "mvp" }),
        "b1c2d3-design.md": ticketSource("design", { project: "mvp" }),
      },
    });

    const frontier = await frontierOf(files);

    expect(frontier.build).toEqual([{ id: "a1b2c3", slug: "build", project: "mvp", gateCount: 0 }]);
    expect(frontier.decide).toEqual([
      {
        project: "mvp",
        destination: "Ship bearing.",
        fogCount: 1,
        tickets: [{ id: "b1c2d3", slug: "design", project: "mvp", gateCount: 0 }],
      },
    ]);
    expect(frontier.triageCount).toBe(2);
    expect(frontier.fogbound).toEqual([]);
  });

  it("keeps a ticket with an unsatisfied blocker out of BUILD until the blocker file is deleted", async () => {
    const blocked = fixture({
      tickets: {
        "a1b2c3-blocker.md": ticketSource("build"),
        "b1c2d3-waiting.md": ticketSource("build", { blockers: ["a1b2c3"] }),
      },
    });

    expect((await frontierOf(blocked)).build.map((ticket) => ticket.id)).toEqual(["a1b2c3"]);

    const blockerClosed = fixture({
      tickets: { "b1c2d3-waiting.md": blocked.tickets["b1c2d3-waiting.md"] as string },
    });
    expect((await frontierOf(blockerClosed)).build.map((ticket) => ticket.id)).toEqual(["b1c2d3"]);
  });

  it("ranks the ready ticket that transitively unblocks more above the one that unblocks less", async () => {
    const files = fixture({
      tickets: {
        "a1b2c3-keystone.md": ticketSource("build", { project: "mvp" }),
        "b1c2d3-leafs.md": ticketSource("build", { project: "mvp" }),
        "c1d2e3-mid.md": ticketSource("build", { project: "mvp", blockers: ["a1b2c3"] }),
        "d1e2f3-leaf.md": ticketSource("build", { project: "mvp", blockers: ["c1d2e3"] }),
      },
    });

    const build = (await frontierOf(files)).build;
    expect(build.map((ticket) => ticket.id)).toEqual(["a1b2c3", "b1c2d3"]);
    expect(build[0]).toMatchObject({ id: "a1b2c3", gateCount: 2 });
    expect(build[1]).toMatchObject({ id: "b1c2d3", gateCount: 0 });
  });

  it("orders design tickets within a group by gate count too", async () => {
    const files = fixture({
      tickets: {
        "a1b2c3-keystone.md": ticketSource("build", { project: "mvp" }),
        "b1c2d3-q1.md": ticketSource("design", { project: "mvp" }),
        "c1d2e3-q2.md": ticketSource("design", { project: "mvp" }),
        "d1e2f3-mid.md": ticketSource("build", { project: "mvp", blockers: ["b1c2d3"] }),
      },
    });

    const decide = (await frontierOf(files)).decide;
    expect(decide[0]?.tickets.map((ticket) => ticket.id)).toEqual(["b1c2d3", "c1d2e3"]);
  });

  it("heads each decide group with the map's destination and fog count", async () => {
    const files = fixture({
      tickets: { "b1c2d3-design.md": ticketSource("design", { project: "mvp" }) },
    });

    const decide = (await frontierOf(files)).decide;
    expect(decide).toEqual([{ project: "mvp", destination: "Ship bearing.", fogCount: 1, tickets: expect.any(Array) }]);
  });

  it("keeps a fog-complete map out of DECIDE while its build tickets remain in BUILD", async () => {
    const files = fixture({
      maps: { "mvp.md": NO_FOG_MAP },
      tickets: {
        "a1b2c3-build.md": ticketSource("build", { project: "mvp" }),
      },
    });

    const frontier = await frontierOf(files);
    expect(frontier.decide).toEqual([]);
    expect(frontier.build).toHaveLength(1);
    expect(frontier.fogbound).toEqual([]);
  });

  it("reports a map with fog and no open design ticket as fogbound, above empty sections", async () => {
    const files = fixture({
      tickets: { "a1b2c3-build.md": ticketSource("build", { project: "mvp" }) },
    });

    const frontier = await frontierOf(files);
    expect(frontier.fogbound).toEqual(["mvp"]);
    expect(frontier.decide).toEqual([]);
  });

  it("does not report fogbound a map whose design ticket is blocked by build work", async () => {
    const files = fixture({
      tickets: {
        "a1b2c3-build.md": ticketSource("build", { project: "mvp" }),
        "b1c2d3-design.md": ticketSource("design", { project: "mvp", blockers: ["a1b2c3"] }),
      },
    });

    const frontier = await frontierOf(files);
    // The map is being worked, so it is not starved; but it has no ready
    // decision, so it is not on the decision frontier either. Its build ticket
    // is where the work is.
    expect(frontier.fogbound).toEqual([]);
    expect(frontier.decide).toEqual([]);
    expect(frontier.build).toHaveLength(1);
  });

  it("orders decide groups by their most consequential decision, not by map filename", async () => {
    const files = fixture({
      maps: { "alpha.md": VALID_MAP, "zulu.md": VALID_MAP },
      tickets: {
        "a1b2c3-quiet.md": ticketSource("design", { project: "alpha" }),
        "b1c2d3-gate.md": ticketSource("design", { project: "zulu" }),
        "c1d2e3-blocked.md": ticketSource("build", { project: "zulu", blockers: ["b1c2d3"] }),
      },
    });

    const frontier = await frontierOf(files);
    expect(frontier.decide.map((group) => group.project)).toEqual(["zulu", "alpha"]);
  });

  it("reports a blocker cycle as a refusal naming the ids in it", async () => {
    const files = fixture({
      tickets: {
        "a1b2c3-one.md": ticketSource("build", { blockers: ["b1c2d3"] }),
        "b1c2d3-two.md": ticketSource("build", { blockers: ["a1b2c3"] }),
      },
    });

    const result = await runFrontier(files);
    expect(result).toEqual({ tag: "cycle", ids: ["a1b2c3", "b1c2d3"] });
  });

  it("refuses a malformed tracker rather than deriving against it", async () => {
    const files = fixture({
      tickets: { "bad.md": "no frontmatter\n" },
    });

    await expect(runFrontier(files)).rejects.toMatchObject({ _tag: "MalformedTrackerError" });
  });
});
