import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Console, Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { main, type OutputWriters, runCommand } from "#src/cli.ts";

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

const capture = () => {
  let text = "";
  return {
    writer: {
      write: (chunk: string) => {
        text += chunk;
      },
    },
    read: () => text,
  };
};

const captureRun = async (run: (output: OutputWriters) => Promise<number>) => {
  const stdout = capture();
  const stderr = capture();
  const exitCode = await run({ stdout: stdout.writer, stderr: stderr.writer });
  return { exitCode, stdout: stdout.read(), stderr: stderr.read() };
};

const ticketSource = (type: "design" | "build", project?: string) => `---
type: ${type}
${project === undefined ? "" : `project: ${project}\n`}---

Body.
`;

const createTracker = async (
  root: string,
  tickets: Readonly<Record<string, string>> = {
    "a1b2c3-first-ticket.md": ticketSource("build"),
    "b1c2d3-design-question.md": `---
type: design
project: mvp
blockers: [a1b2c3]
---

Question body.
`,
  },
  backlog: Readonly<Record<string, string>> = {},
  maps: Readonly<Record<string, string>> = { "mvp.md": VALID_MAP },
) => {
  const tracker = join(root, ".bearing");
  await Promise.all([
    mkdir(join(tracker, "backlog"), { recursive: true }),
    mkdir(join(tracker, "tickets"), { recursive: true }),
    mkdir(join(tracker, "maps"), { recursive: true }),
  ]);
  await Promise.all([
    ...Object.entries(tickets).map(([name, source]) => writeFile(join(tracker, "tickets", name), source)),
    ...Object.entries(backlog).map(([name, source]) => writeFile(join(tracker, "backlog", name), source)),
    ...Object.entries(maps).map(([name, source]) => writeFile(join(tracker, "maps", name), source)),
  ]);
  return tracker;
};

let fixtureRoot: string;
let noTrackerRoot: string;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "bearing-cli-"));
  noTrackerRoot = await mkdtemp(join(tmpdir(), "bearing-cli-none-"));
  await createTracker(fixtureRoot);
});

afterAll(async () => {
  await Promise.all([
    rm(fixtureRoot, { recursive: true, force: true }),
    rm(noTrackerRoot, { recursive: true, force: true }),
  ]);
});

describe("main", () => {
  it("prints the frontier rather than help when called bare", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([], stdout.writer, stderr.writer, fixtureRoot);

    expect(exitCode).toBe(0);
    expect(stderr.read()).toBe("");
    expect(stdout.read()).toContain("BUILD");
    expect(stdout.read()).toContain("first ticket");
    expect(stdout.read()).not.toContain("ls");
  });

  it("fails when no ancestor contains a tracker", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["ls"], stdout.writer, stderr.writer, noTrackerRoot);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain("error: no .bearing tracker found");
  });

  it("refuses a malformed nearest tracker instead of searching farther upward", async () => {
    const nearestRoot = join(fixtureRoot, "malformed-nearest");
    const cwd = join(nearestRoot, "inside");
    await mkdir(join(nearestRoot, ".bearing", "tickets"), { recursive: true });
    await mkdir(cwd, { recursive: true });
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["ls"], stdout.writer, stderr.writer, cwd);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain("error: malformed tracker:");
    expect(stderr.read()).toContain("backlog directory is missing");
    expect(stderr.read()).not.toContain("first ticket");
  });

  it("refuses a .bearing file collision instead of searching farther upward", async () => {
    const nearestRoot = join(fixtureRoot, "collision-nearest");
    const cwd = join(nearestRoot, "inside");
    await mkdir(cwd, { recursive: true });
    await writeFile(join(nearestRoot, ".bearing"), "not a tracker\n");
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["ls"], stdout.writer, stderr.writer, cwd);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain(".bearing must be a directory");
    expect(stderr.read()).not.toContain("first ticket");
  });

  it("refuses a .bearing symlink to a valid tracker", async () => {
    const nearestRoot = join(fixtureRoot, "symlink-nearest");
    const cwd = join(nearestRoot, "inside");
    await mkdir(cwd, { recursive: true });
    await symlink(join(fixtureRoot, ".bearing"), join(nearestRoot, ".bearing"), "dir");
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["ls"], stdout.writer, stderr.writer, cwd);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain(".bearing must not be a symbolic link");
    expect(stderr.read()).not.toContain("first ticket");
  });

  it("refuses a dangling .bearing symlink instead of searching farther upward", async () => {
    const nearestRoot = join(fixtureRoot, "dangling-symlink-nearest");
    const cwd = join(nearestRoot, "inside");
    await mkdir(cwd, { recursive: true });
    await symlink(join(nearestRoot, "missing"), join(nearestRoot, ".bearing"), "dir");
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["ls"], stdout.writer, stderr.writer, cwd);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain(".bearing must not be a symbolic link");
    expect(stderr.read()).not.toContain("first ticket");
  });

  it("rejects an unknown subcommand with a message naming it", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["frobnicate"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown subcommand "frobnicate"');
  });

  it("rejects an unknown flag with a message naming it", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["--frobnicate"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unrecognized flag: --frobnicate");
  });

  it("lists the commands that exist in --help", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["--help"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("show");
    expect(result.stdout).toContain("ls");
    expect(result.stdout).toContain("next");
  });

  it("does not expose the framework's version flag", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["--version"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unrecognized flag: --version");
  });

  it("rejects a missing required argument with a message naming it", async () => {
    const command = Command.make("probe", { target: Argument.string("target") }, () => Effect.void);
    const result = await captureRun((output) => runCommand(command, [], output));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing required argument: target");
  });

  it("fails rather than ignoring unsupported console operations", async () => {
    const command = Command.make("probe", {}, () => Console.clear);
    const result = await captureRun((output) => runCommand(command, [], output));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Console.clear");
  });
});

describe("backlog", () => {
  it("captures a backlog item by writing a heading-only file with no frontmatter", async () => {
    const root = join(fixtureRoot, "backlog-capture");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) =>
      main(["backlog", "Capture a new item"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const files = await readdir(join(root, ".bearing", "backlog"));
    expect(files).toHaveLength(1);
    const filename = files[0] ?? "";
    expect(filename).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]{6}-capture-a-new-item\.md$/);
    const source = await readFile(join(root, ".bearing", "backlog", filename), "utf8");
    expect(source).toBe("# Capture a new item\n");
    expect(source.startsWith("---")).toBe(false);
  });

  it("captures into the nearest ancestor's tracker from a nested directory", async () => {
    const root = join(fixtureRoot, "backlog-nested");
    const cwd = join(root, "deep", "down");
    await createTracker(root);
    await mkdir(cwd, { recursive: true });
    const result = await captureRun(({ stdout, stderr }) => main(["backlog", "Nested capture"], stdout, stderr, cwd));

    expect(result.exitCode).toBe(0);
    const files = await readdir(join(root, ".bearing", "backlog"));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/nested-capture\.md$/);
  });

  it("lists the backlog when called bare", async () => {
    const root = join(fixtureRoot, "backlog-list");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["backlog"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("c1d2e3  captured\n");
  });

  it("emits the backlog values as JSON with --json", async () => {
    const root = join(fixtureRoot, "backlog-json");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["backlog", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([{ id: "c1d2e3", slug: "captured" }]);
  });

  it("emits the captured item's values as JSON with --json", async () => {
    const root = join(fixtureRoot, "backlog-capture-json");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) =>
      main(["backlog", "Json capture", "--json"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout) as { id: string; slug: string; path: string };
    expect(parsed.slug).toBe("json-capture");
    expect(parsed.id).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]{6}$/);
    expect(parsed.path).toContain(".bearing/backlog/");
  });

  it("round-trips a captured item through list and show", async () => {
    const root = join(fixtureRoot, "backlog-roundtrip");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) => main(["backlog", "Round trip item"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    const filename = (await readdir(join(root, ".bearing", "backlog")))[0] ?? "";
    const id = filename.slice(0, 6);
    const listed = await captureRun(({ stdout, stderr }) => main(["backlog"], stdout, stderr, root));
    expect(listed.stdout).toBe(`${id}  round trip item\n`);
    const shown = await captureRun(({ stdout, stderr }) => main(["show", id], stdout, stderr, root));
    expect(shown.stdout).toBe("# Round trip item\n");
  });

  it("refuses a malformed tracker when capturing", async () => {
    const root = join(fixtureRoot, "backlog-malformed");
    await createTracker(root, { "bad.md": "no frontmatter\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["backlog", "Item"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: malformed tracker:");
  });
});

describe("show", () => {
  it("prints a ticket's frontmatter fields and body", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["show", "a1b2c3"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("type: build\n\nBody.\n");
  });

  it("resolves an unambiguous id prefix", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["show", "b1c2"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("type: design\nproject: mvp\nblockers: [a1b2c3]\n\nQuestion body.\n");
  });

  it("prints a backlog item the same way", async () => {
    const root = join(fixtureRoot, "show-backlog");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n\nBacklog body.\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["show", "c1d2e3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("# Captured\n\nBacklog body.\n");
  });

  it("emits the values it rendered with --json", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["show", "a1b2c3", "--json"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      kind: "ticket",
      id: "a1b2c3",
      slug: "first-ticket",
      type: "build",
      project: undefined,
      blockers: [],
      body: "Body.",
      source: "---\ntype: build\n---\n\nBody.\n",
    });
  });

  it("prints the exact source with --full", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["show", "a1b2c3", "--full"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("---\ntype: build\n---\n\nBody.\n");
  });

  it("rejects combining --full and --json before reading the tracker", async () => {
    for (const args of [
      ["show", "a1b2c3", "--full", "--json"],
      ["show", "a1b2c3", "--json", "--full"],
    ]) {
      const result = await captureRun(({ stdout, stderr }) => main(args, stdout, stderr, noTrackerRoot));

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("--full and --json cannot be used together");
      expect(result.stderr).not.toContain("no .bearing tracker found");
    }
  });

  it("exits 1 and names every candidate id for an ambiguous prefix", async () => {
    const root = join(fixtureRoot, "show-ambiguous");
    await createTracker(root, {
      "a1b2c3-one.md": ticketSource("build"),
      "a2b3c4-two.md": ticketSource("build"),
    });
    const result = await captureRun(({ stdout, stderr }) => main(["show", "a"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('ambiguous id prefix "a": a1b2c3, a2b3c4');
  });

  it("exits 1 for a prefix that matches nothing", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["show", "zz"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('no item matches id prefix "zz"');
  });

  it("resolves against the nearest ancestor tracker from a nested directory", async () => {
    const nestedRoot = join(fixtureRoot, "show-nested");
    const cwd = join(nestedRoot, "inside");
    await createTracker(nestedRoot, { "c1d2e3-nearest.md": ticketSource("build") });
    await mkdir(cwd, { recursive: true });
    const result = await captureRun(({ stdout, stderr }) => main(["show", "c1d2e3"], stdout, stderr, cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("type: build\n\nBody.\n");
  });

  it("refuses a malformed tracker rather than resolving against it", async () => {
    const root = join(fixtureRoot, "show-malformed");
    await createTracker(root, { "bad.md": "no frontmatter\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["show", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: malformed tracker:");
  });
});

const SECOND_MAP = `# Second

## Destination

Second destination.

## Notes

## Trail

## Not yet committed

## Not yet specified

### Second fog

## Out of scope
`;

describe("fog", () => {
  it("lists every patch on every map, grouped by project", async () => {
    const root = join(fixtureRoot, "fog-all");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP, "second.md": SECOND_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["fog"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("mvp\n  Reader depth\n\nsecond\n  Second fog\n");
  });

  it("lists only the named map's patches", async () => {
    const root = join(fixtureRoot, "fog-project");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP, "second.md": SECOND_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["fog", "second"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("second\n  Second fog\n");
  });

  it("exits 1 for an unknown project, naming the maps that exist", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["fog", "missing"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('no map for project "missing"; maps: mvp');
  });

  it("reports a map with an empty Not yet specified as having no patches", async () => {
    const root = join(fixtureRoot, "fog-empty");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP.replace("### Reader depth\n\n", "") });
    const result = await captureRun(({ stdout, stderr }) => main(["fog", "mvp"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("mvp\n");
  });

  it("emits the patches it rendered as JSON", async () => {
    const root = join(fixtureRoot, "fog-json");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["fog", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([
      { project: "mvp", patches: [{ heading: "Reader depth", source: "### Reader depth\n\n" }] },
    ]);
  });

  it("prints only the heading text, so rewording a patch changes only that text", async () => {
    const root = join(fixtureRoot, "fog-reworded");
    await createTracker(
      root,
      {},
      {},
      { "mvp.md": VALID_MAP.replace("### Reader depth", "### Reader depth, revisited") },
    );
    const result = await captureRun(({ stdout, stderr }) => main(["fog"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("mvp\n  Reader depth, revisited\n");
  });

  it("never prints intentions from Not yet committed", async () => {
    const root = join(fixtureRoot, "fog-intentions");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["fog"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Ship a reader");
  });

  it("refuses a map with a malformed trail row rather than listing against it", async () => {
    const root = join(fixtureRoot, "fog-malformed");
    const malformed = VALID_MAP.replace("## Trail\n\n", "## Trail\n\n| broken |\n\n");
    await createTracker(root, {}, {}, { "mvp.md": malformed });
    const result = await captureRun(({ stdout, stderr }) => main(["fog"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("trail row must be <id> | <decision> | <outcome>");
  });
});

describe("ls", () => {
  it("discovers and lists a real tracker from a nested directory", async () => {
    const cwd = join(fixtureRoot, "one", "two");
    await mkdir(cwd, { recursive: true });
    const result = await captureRun(({ stdout, stderr }) => main(["ls"], stdout, stderr, cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "a1b2c3  first ticket  build  -  ready\n" +
        "        unblocks: [b1c2d3]\n" +
        "b1c2d3  design question  design  mvp  blocked\n" +
        "        blockers: [a1b2c3]\n" +
        "        blocked by: [a1b2c3]\n",
    );
  });

  it("emits the values it rendered as JSON", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["ls", "--json"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([
      {
        id: "a1b2c3",
        slug: "first-ticket",
        type: "build",
        blockers: [],
        ready: true,
        blockedBy: [],
        unblocks: ["b1c2d3"],
      },
      {
        id: "b1c2d3",
        slug: "design-question",
        type: "design",
        project: "mvp",
        blockers: ["a1b2c3"],
        ready: false,
        blockedBy: ["a1b2c3"],
        unblocks: [],
      },
    ]);
  });

  it("uses the nearest ancestor tracker", async () => {
    const nestedRoot = join(fixtureRoot, "ls-nearest");
    const cwd = join(nestedRoot, "inside");
    await createTracker(nestedRoot, { "c1d2e3-nearest.md": ticketSource("build") });
    await mkdir(cwd, { recursive: true });
    const result = await captureRun(({ stdout, stderr }) => main(["ls"], stdout, stderr, cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("c1d2e3  nearest  build  -  ready\n");
  });

  it("filters by type", async () => {
    const build = await captureRun(({ stdout, stderr }) => main(["ls", "--build"], stdout, stderr, fixtureRoot));
    expect(build.exitCode).toBe(0);
    expect(build.stdout).toBe("a1b2c3  first ticket  build  -  ready\n        unblocks: [b1c2d3]\n");

    const design = await captureRun(({ stdout, stderr }) => main(["ls", "--design"], stdout, stderr, fixtureRoot));
    expect(design.exitCode).toBe(0);
    expect(design.stdout).toBe(
      "b1c2d3  design question  design  mvp  blocked\n" +
        "        blockers: [a1b2c3]\n" +
        "        blocked by: [a1b2c3]\n",
    );
  });

  it("filters by readiness", async () => {
    const ready = await captureRun(({ stdout, stderr }) => main(["ls", "--ready"], stdout, stderr, fixtureRoot));
    expect(ready.exitCode).toBe(0);
    expect(ready.stdout).toBe("a1b2c3  first ticket  build  -  ready\n        unblocks: [b1c2d3]\n");

    const blocked = await captureRun(({ stdout, stderr }) => main(["ls", "--blocked"], stdout, stderr, fixtureRoot));
    expect(blocked.exitCode).toBe(0);
    expect(blocked.stdout).toBe(
      "b1c2d3  design question  design  mvp  blocked\n" +
        "        blockers: [a1b2c3]\n" +
        "        blocked by: [a1b2c3]\n",
    );
  });

  it("filters by project", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["ls", "--project", "mvp"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "b1c2d3  design question  design  mvp  blocked\n" +
        "        blockers: [a1b2c3]\n" +
        "        blocked by: [a1b2c3]\n",
    );
  });

  it("intersects combined filters rather than erroring", async () => {
    const none = await captureRun(({ stdout, stderr }) =>
      main(["ls", "--build", "--design"], stdout, stderr, fixtureRoot),
    );
    expect(none.exitCode).toBe(0);
    expect(none.stdout).toBe("\n");

    const blocked = await captureRun(({ stdout, stderr }) =>
      main(["ls", "--design", "--blocked"], stdout, stderr, fixtureRoot),
    );
    expect(blocked.exitCode).toBe(0);
    expect(blocked.stdout).toBe(
      "b1c2d3  design question  design  mvp  blocked\n" +
        "        blockers: [a1b2c3]\n" +
        "        blocked by: [a1b2c3]\n",
    );
  });

  it("emits the filtered values it rendered as JSON", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["ls", "--ready", "--json"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      {
        id: "a1b2c3",
        slug: "first-ticket",
        type: "build",
        blockers: [],
        ready: true,
        blockedBy: [],
        unblocks: ["b1c2d3"],
      },
    ]);
  });

  it("treats a ticket naming an absorbed blocker as ready", async () => {
    const root = join(fixtureRoot, "ls-absorbed");
    await createTracker(root, {
      "a1b2c3-absorbed.md": `---
type: build
blockers: [zzzzzz]
---

Body.
`,
    });

    const all = await captureRun(({ stdout, stderr }) => main(["ls"], stdout, stderr, root));
    expect(all.exitCode).toBe(0);
    expect(all.stdout).toBe("a1b2c3  absorbed  build  -  ready\n        blockers: [zzzzzz]\n");

    const blocked = await captureRun(({ stdout, stderr }) => main(["ls", "--blocked"], stdout, stderr, root));
    expect(blocked.stdout).toBe("\n");

    const ready = await captureRun(({ stdout, stderr }) => main(["ls", "--ready"], stdout, stderr, root));
    expect(ready.stdout).toBe("a1b2c3  absorbed  build  -  ready\n        blockers: [zzzzzz]\n");
  });

  it("reports a blocker cycle as a refusal naming the ids in it", async () => {
    const root = join(fixtureRoot, "ls-cycle");
    await createTracker(root, {
      "a1b2c3-one.md": `---
type: build
blockers: [b1c2d3]
---

One.
`,
      "b1c2d3-two.md": `---
type: build
blockers: [a1b2c3]
---

Two.
`,
    });

    const result = await captureRun(({ stdout, stderr }) => main(["ls"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: blocker cycle: [a1b2c3, b1c2d3]");
  });

  it("exits 1 for a project no map carries, naming the maps that exist", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["ls", "--project", "missing"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('no map for project "missing"; maps: mvp');
  });

  it("refuses a malformed tracker rather than listing against it", async () => {
    const root = join(fixtureRoot, "ls-malformed");
    await createTracker(root, { "bad.md": "no frontmatter\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["ls"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: malformed tracker:");
  });
});

describe("next", () => {
  it("prints BUILD, DECIDE, and TRIAGE in that order, with TRIAGE a count", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "BUILD\n" + "a1b2c3  first ticket  -\n" + "DECIDE\n" + "Ship bearing. (mvp, 1 fog)\n" + "TRIAGE\n" + "0\n",
    );
  });

  it("renders the same value as bare bearing, and the same JSON either way", async () => {
    const bare = await captureRun(({ stdout, stderr }) => main([], stdout, stderr, fixtureRoot));
    const next = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, fixtureRoot));

    expect(bare.exitCode).toBe(0);
    expect(next.exitCode).toBe(0);
    expect(next.stdout).toBe(bare.stdout);

    const bareJson = await captureRun(({ stdout, stderr }) => main(["--json"], stdout, stderr, fixtureRoot));
    const nextJson = await captureRun(({ stdout, stderr }) => main(["next", "--json"], stdout, stderr, fixtureRoot));
    expect(nextJson.stdout).toBe(bareJson.stdout);
    expect(JSON.parse(nextJson.stdout)).toEqual({
      build: [{ id: "a1b2c3", slug: "first-ticket", gateCount: 1 }],
      decide: [{ project: "mvp", destination: "Ship bearing.", fogCount: 1, tickets: [] }],
      triageCount: 0,
      fogbound: [],
    });
  });

  it("keeps a build ticket out of BUILD until its blocker file is deleted", async () => {
    const root = join(fixtureRoot, "next-blocked");
    const mapWithoutFog = VALID_MAP.replace("### Reader depth\n\n", "");
    await createTracker(
      root,
      {
        "a1b2c3-blocker.md": ticketSource("build"),
        "b1c2d3-waiting.md": `---
type: build
blockers: [a1b2c3]
---

Waiting.
`,
      },
      {},
      { "mvp.md": mapWithoutFog },
    );

    const before = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));
    expect(before.stdout).toBe("BUILD\na1b2c3  blocker  -\nDECIDE\nTRIAGE\n0\n");

    await rm(join(root, ".bearing/tickets/a1b2c3-blocker.md"));

    const after = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));
    expect(after.stdout).toBe("BUILD\nb1c2d3  waiting  -\nDECIDE\nTRIAGE\n0\n");
  });

  it("ranks the ready ticket that transitively unblocks more above the one that unblocks less", async () => {
    const root = join(fixtureRoot, "next-rank");
    const mapWithoutFog = VALID_MAP.replace("### Reader depth\n\n", "");
    await createTracker(
      root,
      {
        "a1b2c3-keystone.md": ticketSource("build"),
        "b1c2d3-leafs.md": ticketSource("build"),
        "c1d2e3-mid.md": `---
type: build
blockers: [a1b2c3]
---

Mid.
`,
        "d1e2f3-leaf.md": `---
type: build
blockers: [c1d2e3]
---

Leaf.
`,
      },
      {},
      { "mvp.md": mapWithoutFog },
    );

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "BUILD\n" + "a1b2c3  keystone  -\n" + "b1c2d3  leafs  -\n" + "DECIDE\n" + "TRIAGE\n" + "0\n",
    );
  });

  it("keeps a fog-complete map out of DECIDE while its build tickets remain", async () => {
    const root = join(fixtureRoot, "next-fog-complete");
    const mapWithoutFog = VALID_MAP.replace("### Reader depth\n\n", "");
    await createTracker(root, { "a1b2c3-build.md": ticketSource("build") }, {}, { "mvp.md": mapWithoutFog });

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.stdout).toBe("BUILD\na1b2c3  build  -\nDECIDE\nTRIAGE\n0\n");
  });

  it("prints a fogbound map above the sections, including when BUILD and DECIDE are both empty", async () => {
    const root = join(fixtureRoot, "next-fogbound");

    await createTracker(root, {});

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("mvp is fogbound: fog left, no open design tickets\nBUILD\nDECIDE\nTRIAGE\n0\n");
  });

  it("keeps a map out of the fogbound report while its design ticket is blocked by build work", async () => {
    const root = join(fixtureRoot, "next-not-fogbound");
    await createTracker(root, {
      "a1b2c3-build.md": ticketSource("build"),
      "b1c2d3-design.md": `---
type: design
project: mvp
blockers: [a1b2c3]
---

Question.
`,
    });

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("fogbound");
    expect(result.stdout).toContain("Ship bearing. (mvp, 1 fog)\n");
  });

  it("reports a blocker cycle as a refusal naming the ids in it", async () => {
    const root = join(fixtureRoot, "next-cycle");
    await createTracker(root, {
      "a1b2c3-one.md": `---
type: build
blockers: [b1c2d3]
---

One.
`,
      "b1c2d3-two.md": `---
type: build
blockers: [a1b2c3]
---

Two.
`,
    });

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: blocker cycle: [a1b2c3, b1c2d3]");
  });

  it("refuses a malformed tracker rather than deriving against it", async () => {
    const root = join(fixtureRoot, "next-malformed");
    await createTracker(root, { "bad.md": "no frontmatter\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: malformed tracker:");
  });
});

const missing = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
};

describe("close", () => {
  it("deletes a build ticket on the first invocation and strips its id from every blocker list", async () => {
    const root = join(fixtureRoot, "close-build");
    await createTracker(root, {
      "a1b2c3-first.md": ticketSource("build"),
      "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Second.
`,
    });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      `deleted ${root}/.bearing/tickets/a1b2c3-first.md\n` +
        `stripped a1b2c3 from ${root}/.bearing/tickets/b1c2d3-second.md\n`,
    );
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(true);
    await expect(readFile(join(root, ".bearing/tickets/b1c2d3-second.md"), "utf8")).resolves.toBe(
      `---
type: build
---

Second.
`,
    );
  });

  it("applies immediately on the first invocation with no dry run", async () => {
    const root = join(fixtureRoot, "close-immediate");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("build") });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(true);
  });

  it("accepts done as an alias for close", async () => {
    const root = join(fixtureRoot, "close-done");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("build") });
    const result = await captureRun(({ stdout, stderr }) => main(["done", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(true);
  });

  it("refuses a design ticket instead of falling through, deleting nothing", async () => {
    const root = join(fixtureRoot, "close-design");
    await createTracker(root, {
      "a1b2c3-first.md": `---
type: design
project: mvp
---

Question.
`,
    });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("cannot close design ticket");
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(false);
  });

  it("refuses a backlog item, naming bearing rm as the way to delete it", async () => {
    const root = join(fixtureRoot, "close-backlog");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "c1d2e3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("cannot close backlog item");
    expect(result.stderr).toContain("use bearing rm");
    await expect(missing(join(root, ".bearing/backlog/c1d2e3-captured.md"))).resolves.toBe(false);
  });

  it("exits 1 for a prefix that matches nothing", async () => {
    const root = join(fixtureRoot, "close-nomatch");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) => main(["close", "zzzz"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('no item matches id prefix "zzzz"');
  });

  it("emits the values it rendered as JSON with --json", async () => {
    const root = join(fixtureRoot, "close-json");
    await createTracker(root, {
      "a1b2c3-first.md": ticketSource("build"),
      "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Second.
`,
    });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      id: "a1b2c3",
      removed: `${root}/.bearing/tickets/a1b2c3-first.md`,
      rewrote: [`${root}/.bearing/tickets/b1c2d3-second.md`],
    });
  });
});

describe("rm", () => {
  it("deletes a backlog item immediately", async () => {
    const root = join(fixtureRoot, "rm-backlog");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });
    const result = await captureRun(({ stdout, stderr }) => main(["rm", "c1d2e3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`deleted ${root}/.bearing/backlog/c1d2e3-captured.md\n`);
    await expect(missing(join(root, ".bearing/backlog/c1d2e3-captured.md"))).resolves.toBe(true);
  });

  it("accepts delete as an alias for rm", async () => {
    const root = join(fixtureRoot, "rm-delete");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("build") });
    const result = await captureRun(({ stdout, stderr }) => main(["delete", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(true);
  });

  it("deletes a design ticket without close semantics", async () => {
    const root = join(fixtureRoot, "rm-design");
    await createTracker(root, {
      "a1b2c3-first.md": `---
type: design
project: mvp
---

Question.
`,
    });
    const result = await captureRun(({ stdout, stderr }) => main(["rm", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(true);
  });

  it("strips the removed id from tickets that named it", async () => {
    const root = join(fixtureRoot, "rm-strip");
    await createTracker(root, {
      "a1b2c3-first.md": ticketSource("build"),
      "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3, c1d2e3]
---

Second.
`,
    });
    const result = await captureRun(({ stdout, stderr }) => main(["rm", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    await expect(readFile(join(root, ".bearing/tickets/b1c2d3-second.md"), "utf8")).resolves.toBe(
      `---
type: build
blockers: [c1d2e3]
---

Second.
`,
    );
  });

  it("exits 1 for an ambiguous prefix, naming the candidates", async () => {
    const root = join(fixtureRoot, "rm-ambiguous");
    await createTracker(root, {
      "a1b2c3-one.md": ticketSource("build"),
      "a2b3c4-two.md": ticketSource("build"),
    });
    const result = await captureRun(({ stdout, stderr }) => main(["rm", "a"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('ambiguous id prefix "a": a1b2c3, a2b3c4');
  });
});
