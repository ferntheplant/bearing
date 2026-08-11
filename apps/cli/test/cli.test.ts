import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
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
  it("discovers and lists a real tracker from a nested directory", async () => {
    const cwd = join(fixtureRoot, "one", "two");
    await mkdir(cwd, { recursive: true });
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([], stdout.writer, stderr.writer, cwd);

    expect(exitCode).toBe(0);
    expect(stderr.read()).toBe("");
    expect(stdout.read()).toBe(
      "a1b2c3  first ticket  build  -\n" + "b1c2d3  design question  design  mvp\n" + "        blockers: [a1b2c3]\n",
    );
  });

  it("emits the same ticket values as JSON", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["--json"], stdout.writer, stderr.writer, fixtureRoot);

    expect(exitCode).toBe(0);
    expect(stderr.read()).toBe("");
    expect(JSON.parse(stdout.read())).toEqual([
      {
        id: "a1b2c3",
        slug: "first-ticket",
        type: "build",
        blockers: [],
      },
      {
        id: "b1c2d3",
        slug: "design-question",
        type: "design",
        project: "mvp",
        blockers: ["a1b2c3"],
      },
    ]);
  });

  it("uses the nearest ancestor tracker", async () => {
    const nestedRoot = join(fixtureRoot, "nearest");
    const cwd = join(nestedRoot, "inside");
    await createTracker(nestedRoot, { "c1d2e3-nearest.md": ticketSource("build") });
    await mkdir(cwd, { recursive: true });
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([], stdout.writer, stderr.writer, cwd);

    expect(exitCode).toBe(0);
    expect(stderr.read()).toBe("");
    expect(stdout.read()).toBe("c1d2e3  nearest  build  -\n");
  });

  it("fails when no ancestor contains a tracker", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([], stdout.writer, stderr.writer, noTrackerRoot);

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

    const exitCode = await main([], stdout.writer, stderr.writer, cwd);

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

    const exitCode = await main([], stdout.writer, stderr.writer, cwd);

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

    const exitCode = await main([], stdout.writer, stderr.writer, cwd);

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

    const exitCode = await main([], stdout.writer, stderr.writer, cwd);

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
