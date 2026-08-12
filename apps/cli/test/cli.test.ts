import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Console, Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { colorsWanted, main, type OutputWriters, runCommand } from "#src/cli.ts";

/** The escape byte, spelled out so no assertion carries a control character. */
const ESC = "\u001B";

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
  it("prints help rather than the frontier when called bare", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([], stdout.writer, stderr.writer, fixtureRoot);

    expect(exitCode).toBe(0);
    expect(stderr.read()).toBe("");
    expect(stdout.read()).toContain("SUBCOMMANDS");
    expect(stdout.read()).toContain("next");
    expect(stdout.read()).not.toContain("BUILD");
  });

  it("prints help from a directory with no tracker at all, without failing", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([], stdout.writer, stderr.writer, noTrackerRoot);

    expect(exitCode).toBe(0);
    expect(stdout.read()).toContain("SUBCOMMANDS");
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

  it("terminates help with a newline so a shell does not mark a partial line", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["--help"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stdout.endsWith("\n")).toBe(true);
    expect(result.stdout.endsWith("\n\n")).toBe(false);
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

  it("accepts the global --json before the subcommand, not only after it", async () => {
    const before = await captureRun(({ stdout, stderr }) => main(["--json", "ls"], stdout, stderr, fixtureRoot));
    const after = await captureRun(({ stdout, stderr }) => main(["ls", "--json"], stdout, stderr, fixtureRoot));

    expect(before.exitCode).toBe(0);
    expect(before.stderr).toBe("");
    expect(before.stdout).toBe(after.stdout);
    expect(JSON.parse(before.stdout)).toHaveLength(2);
  });

  it.each([
    "init",
    "show",
    "backlog",
    "add",
    "fog",
    "doctor",
    "next",
    "ls",
    "close",
    "rm",
    "retitle",
    "triage",
    "completion",
  ])("describes every argument %s takes, rather than printing a bare name and type", async (command) => {
    const result = await captureRun(({ stdout, stderr }) => main([command, "--help"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");

    const lines = result.stdout.split("\n");
    const start = lines.indexOf("ARGUMENTS");
    if (start === -1) {
      return;
    }
    const argumentLines = lines.slice(start + 1, lines.indexOf("", start + 1));
    expect(argumentLines.length).toBeGreaterThan(0);
    for (const line of argumentLines) {
      // "  <name> <type>   <description>" — three fields, not two.
      expect(
        line
          .trim()
          .split(/\s{2,}/)
          .filter(Boolean).length,
      ).toBeGreaterThan(1);
    }
  });

  it("rejects the retired check command, which bearing doctor replaced", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["check"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown subcommand "check"');
  });

  it("fails rather than ignoring unsupported console operations", async () => {
    const command = Command.make("probe", {}, () => Console.clear);
    const result = await captureRun((output) => runCommand(command, [], output));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Console.clear");
  });
});

describe("colour", () => {
  it.each([
    ["a terminal with NO_COLOR unset", {}, true, true],
    ["a terminal with NO_COLOR set", { NO_COLOR: "1" }, true, false],
    ["a pipe, whatever NO_COLOR says", {}, false, false],
    // The convention is that NO_COLOR counts when present and non-empty.
    ["a terminal with NO_COLOR set to empty", { NO_COLOR: "" }, true, true],
  ])("wants colour on %s", (_case, env, isTTY, expected) => {
    expect(colorsWanted(env, isTTY)).toBe(expected);
  });

  it("treats an absent isTTY the way node reports a non-terminal", () => {
    expect(colorsWanted({}, undefined)).toBe(false);
  });

  it("paints a real listing when colour is on", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["ls"], stdout, stderr, fixtureRoot, undefined, true));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(ESC);
    expect(result.stdout).toContain("first ticket");
  });

  it("never paints --json output, even with colour on", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["ls", "--json"], stdout, stderr, fixtureRoot, undefined, true),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain(ESC);
    expect(JSON.parse(result.stdout)).toHaveLength(2);
  });

  it("emits nothing but plain text when colour is off", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["ls"], stdout, stderr, fixtureRoot, undefined, false),
    );

    expect(result.stdout).not.toContain(ESC);
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

describe("add", () => {
  it("creates a projectless build ticket immediately with no project or blockers key", async () => {
    const root = join(fixtureRoot, "new-build");
    await createTracker(root);

    const result = await captureRun(({ stdout, stderr }) =>
      main(["add", "build", "Ship the feature"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const files = await readdir(join(root, ".bearing/tickets"));
    const created = files.find((filename) => filename.endsWith("-ship-the-feature.md"));
    expect(created).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]{6}-ship-the-feature\.md$/);
    const source = await readFile(join(root, ".bearing/tickets", created ?? ""), "utf8");
    expect(source).toBe(`---
type: build
---

# Ship the feature
`);
    expect(source).not.toContain("project:");
    expect(source).not.toContain("blockers:");
  });

  it("creates a design ticket in an existing project", async () => {
    const root = join(fixtureRoot, "new-design");
    await createTracker(root);

    const result = await captureRun(({ stdout, stderr }) =>
      main(["add", "design", "Choose the seam", "--project", "mvp"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    const files = await readdir(join(root, ".bearing/tickets"));
    const created = files.find((filename) => filename.endsWith("-choose-the-seam.md"));
    const source = await readFile(join(root, ".bearing/tickets", created ?? ""), "utf8");
    expect(source).toBe(`---
type: design
project: mvp
---

# Choose the seam
`);
    expect(source).not.toContain("blockers:");
  });

  it("emits the created ticket values as JSON with --json", async () => {
    const root = join(fixtureRoot, "new-json");
    await createTracker(root);

    const result = await captureRun(({ stdout, stderr }) =>
      main(["add", "build", "Json ticket", "--json"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout) as { id: string; slug: string; path: string };
    expect(parsed).toMatchObject({ slug: "json-ticket" });
    expect(parsed.id).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]{6}$/);
    expect(parsed.path).toContain(".bearing/tickets/");
  });

  it("refuses a design ticket with no project, names every map, and creates nothing", async () => {
    const root = join(fixtureRoot, "new-design-no-project");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP, "other.md": VALID_MAP.replace("# MVP", "# Other") });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["add", "design", "Choose the seam"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("cannot create a design ticket without --project; maps: mvp, other");
    expect(await readdir(join(root, ".bearing/tickets"))).toEqual([]);
  });

  it("refuses a project no map carries, names every map, and creates nothing", async () => {
    const root = join(fixtureRoot, "new-missing-project");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP, "other.md": VALID_MAP.replace("# MVP", "# Other") });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["add", "build", "Ship the feature", "--project", "missing"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('no map for project "missing"; maps: mvp, other');
    expect(await readdir(join(root, ".bearing/tickets"))).toEqual([]);
  });

  it("names the choices for its type argument in help, which the framework does not", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["add", "--help"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("build | design");
  });
});

describe("retired names", () => {
  it.each(["new", "create", "done", "delete"])("rejects %s, which is no longer a command", async (command) => {
    const root = join(fixtureRoot, `retired-${command}`);
    await createTracker(root, { "a1b2c3-first.md": ticketSource("build") });

    const result = await captureRun(({ stdout, stderr }) => main([command, "build", "A ticket"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(command);
    expect(await readdir(join(root, ".bearing/tickets"))).toEqual(["a1b2c3-first.md"]);
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
    expect(result.stdout).toBe("type: design\nproject: mvp\nblockers: a1b2c3\n\nQuestion body.\n");
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
      "build   -    ready    a1b2c3  first ticket\n" +
        `${" ".repeat(30)}unblocks: b1c2d3\n` +
        "design  mvp  blocked  b1c2d3  design question\n" +
        `${" ".repeat(30)}blockers: a1b2c3\n` +
        `${" ".repeat(30)}blocked by: a1b2c3\n`,
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
    expect(result.stdout).toBe("build  -  ready  c1d2e3  nearest\n");
  });

  it("filters by type", async () => {
    const build = await captureRun(({ stdout, stderr }) => main(["ls", "--build"], stdout, stderr, fixtureRoot));
    expect(build.exitCode).toBe(0);
    expect(build.stdout).toBe(`build  -  ready  a1b2c3  first ticket\n${" ".repeat(25)}unblocks: b1c2d3\n`);

    const design = await captureRun(({ stdout, stderr }) => main(["ls", "--design"], stdout, stderr, fixtureRoot));
    expect(design.exitCode).toBe(0);
    expect(design.stdout).toBe(
      "design  mvp  blocked  b1c2d3  design question\n" +
        `${" ".repeat(30)}blockers: a1b2c3\n` +
        `${" ".repeat(30)}blocked by: a1b2c3\n`,
    );
  });

  it("filters by readiness", async () => {
    const ready = await captureRun(({ stdout, stderr }) => main(["ls", "--ready"], stdout, stderr, fixtureRoot));
    expect(ready.exitCode).toBe(0);
    expect(ready.stdout).toBe(`build  -  ready  a1b2c3  first ticket\n${" ".repeat(25)}unblocks: b1c2d3\n`);

    const blocked = await captureRun(({ stdout, stderr }) => main(["ls", "--blocked"], stdout, stderr, fixtureRoot));
    expect(blocked.exitCode).toBe(0);
    expect(blocked.stdout).toBe(
      "design  mvp  blocked  b1c2d3  design question\n" +
        `${" ".repeat(30)}blockers: a1b2c3\n` +
        `${" ".repeat(30)}blocked by: a1b2c3\n`,
    );
  });

  it("filters by project", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["ls", "--project", "mvp"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "design  mvp  blocked  b1c2d3  design question\n" +
        `${" ".repeat(30)}blockers: a1b2c3\n` +
        `${" ".repeat(30)}blocked by: a1b2c3\n`,
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
      "design  mvp  blocked  b1c2d3  design question\n" +
        `${" ".repeat(30)}blockers: a1b2c3\n` +
        `${" ".repeat(30)}blocked by: a1b2c3\n`,
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
    expect(all.stdout).toBe(`build  -  ready  a1b2c3  absorbed\n${" ".repeat(25)}blockers: zzzzzz\n`);

    const blocked = await captureRun(({ stdout, stderr }) => main(["ls", "--blocked"], stdout, stderr, root));
    expect(blocked.stdout).toBe("\n");

    const ready = await captureRun(({ stdout, stderr }) => main(["ls", "--ready"], stdout, stderr, root));
    expect(ready.stdout).toBe(`build  -  ready  a1b2c3  absorbed\n${" ".repeat(25)}blockers: zzzzzz\n`);
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
    // The map's only design ticket is closed, so DECIDE has no group to print.
    expect(result.stdout).toBe("BUILD\n" + "  a1b2c3  first ticket\n" + "DECIDE\n" + "TRIAGE\n" + "  0\n");
  });

  it("emits the frontier as a value with the global --json flag", async () => {
    const nextJson = await captureRun(({ stdout, stderr }) => main(["next", "--json"], stdout, stderr, fixtureRoot));

    expect(nextJson.exitCode).toBe(0);
    expect(JSON.parse(nextJson.stdout)).toEqual({
      build: [{ id: "a1b2c3", slug: "first-ticket", gateCount: 1 }],
      decide: [],
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
    expect(before.stdout).toBe("BUILD\n  a1b2c3  blocker\nDECIDE\nTRIAGE\n  0\n");

    await rm(join(root, ".bearing/tickets/a1b2c3-blocker.md"));

    const after = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));
    expect(after.stdout).toBe("BUILD\n  b1c2d3  waiting\nDECIDE\nTRIAGE\n  0\n");
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
      "BUILD\n" + "  a1b2c3  keystone\n" + "  b1c2d3  leafs\n" + "DECIDE\n" + "TRIAGE\n" + "  0\n",
    );
  });

  it("keeps a fog-complete map out of DECIDE while its build tickets remain", async () => {
    const root = join(fixtureRoot, "next-fog-complete");
    const mapWithoutFog = VALID_MAP.replace("### Reader depth\n\n", "");
    await createTracker(root, { "a1b2c3-build.md": ticketSource("build") }, {}, { "mvp.md": mapWithoutFog });

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.stdout).toBe("BUILD\n  a1b2c3  build\nDECIDE\nTRIAGE\n  0\n");
  });

  it("prints a fogbound map above the sections, including when BUILD and DECIDE are both empty", async () => {
    const root = join(fixtureRoot, "next-fogbound");

    await createTracker(root, {});

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("mvp is fogbound: fog left, no open design tickets\nBUILD\nDECIDE\nTRIAGE\n  0\n");
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
    // Not starved — someone is working it — but with no ready decision it has
    // no DECIDE group either. The build ticket is where the work is.
    expect(result.stdout).not.toContain("fogbound");
    expect(result.stdout).toBe("BUILD\n  a1b2c3  build\nDECIDE\nTRIAGE\n  0\n");
  });

  it("heads a decide group with its project and fog count rather than the destination prose", async () => {
    const root = join(fixtureRoot, "next-decide-heading");
    await createTracker(root, { "b1c2d3-design.md": ticketSource("design", "mvp") });

    const result = await captureRun(({ stdout, stderr }) => main(["next"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Ship bearing");
    expect(result.stdout).toBe("BUILD\nDECIDE\n  mvp  1 fog\n    b1c2d3  design\nTRIAGE\n  0\n");
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

const TRAIL_MAP = `# MVP

## Destination

Ship bearing.

## Notes

## Trail

| id | Decision | Outcome |
| --- | --- | --- |
| a1b2c3 | Some decision | [row](outcome) |

## Not yet committed

### Ship a reader

## Not yet specified

### Reader depth

## Out of scope
`;

describe("doctor", () => {
  it("reports nothing for a clean tracker, saying so rather than printing nothing", async () => {
    const root = join(fixtureRoot, "check-clean");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) => main(["doctor"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "ok    document parsing\n" +
        "ok    id collisions\n" +
        "ok    ticket types\n" +
        "ok    design ticket projects\n" +
        "ok    project references\n" +
        "ok    blocker references\n" +
        "ok    trail rows\n" +
        "\n" +
        "7 checks, tracker is consistent\n",
    );
  });

  it("names every check it ran, so a passing one is visibly a check that happened", async () => {
    const root = join(fixtureRoot, "check-names");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) => main(["doctor"], stdout, stderr, root));

    for (const check of [
      "document parsing",
      "id collisions",
      "ticket types",
      "design ticket projects",
      "project references",
      "blocker references",
      "trail rows",
    ]) {
      expect(result.stdout).toContain(check);
    }
  });

  it("exits 0 for warnings and no errors, rendering the warning under its check with the named fix", async () => {
    const root = join(fixtureRoot, "check-warning");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("design", "mvp") }, {}, { "mvp.md": TRAIL_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["doctor"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("warn  trail rows");
    expect(result.stdout).toContain(`${root}/.bearing/maps/mvp.md: trail row names ticket a1b2c3, which still exists`);
    expect(result.stdout).toContain("run: bearing close a1b2c3");
    expect(result.stdout).toContain("7 checks, 1 warning");
  });

  it("enters the design-close flow when the warning's named command is run", async () => {
    const root = join(fixtureRoot, "check-warning-fix");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("design", "mvp") }, {}, { "mvp.md": TRAIL_MAP });
    const check = await captureRun(({ stdout, stderr }) => main(["doctor"], stdout, stderr, root));
    const command = /run: bearing (\S+) (\S+)/.exec(check.stdout);

    expect(command).not.toBeNull();
    const close = await captureRun(({ stdout, stderr }) =>
      main([command?.[1] ?? "", command?.[2] ?? ""], stdout, stderr, root),
    );

    expect(close.exitCode).toBe(0);
    expect(close.stderr).toBe("");
    expect(close.stdout).toContain("| a1b2c3 | Some decision | [row](outcome) |");
  });

  it("exits 1 for any error, reporting every class in one run", async () => {
    const root = join(fixtureRoot, "check-errors");
    await createTracker(
      root,
      {
        "a1b2c3-first.md": `---
type: design
project: mvp
blockers: [zzzzzz]
---

Body.
`,
        "b1c2d3-second.md": `---
type: build
project: missing
---

Body.
`,
      },
      {},
      { "mvp.md": TRAIL_MAP },
    );
    const result = await captureRun(({ stdout, stderr }) => main(["doctor"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("fail  blocker references");
    expect(result.stdout).toContain("fail  project references");
    expect(result.stdout).toContain("names blocker zzzzzz, which does not exist");
    expect(result.stdout).toContain("names project missing, which no map carries");
    // The checks that passed still say so, in the same run.
    expect(result.stdout).toContain("ok    id collisions");
  });

  it("emits the values it rendered as JSON, carrying the severity in the data", async () => {
    const root = join(fixtureRoot, "check-json");
    await createTracker(
      root,
      {
        "a1b2c3-first.md": `---
type: build
blockers: [zzzzzz]
---

Body.
`,
      },
      {},
      { "mvp.md": TRAIL_MAP },
    );
    const result = await captureRun(({ stdout, stderr }) => main(["doctor", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout) as { findings: { severity: string }[] };
    expect(parsed.findings.map((finding) => finding.severity)).toContain("error");
    expect(parsed.findings.map((finding) => finding.severity)).toContain("warning");
  });

  it("carries every check, passing or not, in the JSON as well as the text", async () => {
    const root = join(fixtureRoot, "check-json-checks");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) => main(["doctor", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      checks: { name: string; severity: string; findings: unknown[] }[];
    };
    expect(parsed.checks.map((check) => check.name)).toEqual([
      "parse",
      "duplicate-id",
      "unknown-type",
      "design-no-project",
      "project-missing",
      "blocker-missing",
      "trail-row-open-ticket",
    ]);
    expect(parsed.checks.every((check) => check.findings.length === 0)).toBe(true);
    expect(parsed.checks.at(-1)?.severity).toBe("warning");
  });

  it("reports a warnings-only tracker as zero via --json too", async () => {
    const root = join(fixtureRoot, "check-json-warning");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("design", "mvp") }, {}, { "mvp.md": TRAIL_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["doctor", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout) as { findings: { severity: string }[] };
    expect(parsed.findings).toEqual([
      {
        severity: "warning",
        kind: "trail-row-open-ticket",
        path: `${root}/.bearing/maps/mvp.md`,
        id: "a1b2c3",
      },
    ]);
  });

  it("rejects a bulk-applying flag instead of applying it", async () => {
    const root = join(fixtureRoot, "check-fix");
    await createTracker(root);
    const result = await captureRun(({ stdout, stderr }) => main(["doctor", "--fix"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unrecognized flag: --fix");
  });

  it("fails when no ancestor contains a tracker", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["doctor"], stdout, stderr, noTrackerRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: no .bearing tracker found");
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

  it("does not advertise the design-close applying flag in help", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["close", "--help"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("--confirm");
  });

  it("prints a design-close dry run with the ticket and byte-identical trail row, changing nothing", async () => {
    const root = join(fixtureRoot, "close-design-dry-run");
    const source = `---
type: design
project: mvp
---

# Question

Is this settled?
`;
    await createTracker(
      root,
      {
        "a1b2c3-first.md": source,
        "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Second.
`,
      },
      {},
      { "mvp.md": TRAIL_MAP },
    );
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(source.trimEnd());
    expect(result.stdout).toContain("| a1b2c3 | Some decision | [row](outcome) |");
    expect(result.stdout).toContain(`WOULD DELETE ${root}/.bearing/tickets/a1b2c3-first.md`);
    expect(result.stdout).toContain(`WOULD UNBLOCK b1c2d3 ${root}/.bearing/tickets/b1c2d3-second.md`);
    expect(result.stdout).toContain("Re-run with: bearing close a1b2c3 --confirm");
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(false);
    await expect(readFile(join(root, ".bearing/tickets/b1c2d3-second.md"), "utf8")).resolves.toContain(
      "blockers: [a1b2c3]",
    );
  });

  it("emits the design-close plan as JSON without applying it", async () => {
    const root = join(fixtureRoot, "close-design-json");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("design", "mvp") }, {}, { "mvp.md": TRAIL_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      kind: "design",
      ticket: {
        id: "a1b2c3",
        project: "mvp",
        path: `${root}/.bearing/tickets/a1b2c3-first.md`,
        source: ticketSource("design", "mvp"),
      },
      trail: {
        path: `${root}/.bearing/maps/mvp.md`,
        row: {
          id: "a1b2c3",
          source: "| a1b2c3 | Some decision | [row](outcome) |",
        },
      },
      unblocks: [],
      rewrites: [],
    });
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(false);
  });

  it("applies a design close under the flag printed by the dry run", async () => {
    const root = join(fixtureRoot, "close-design-confirm");
    await createTracker(
      root,
      {
        "a1b2c3-first.md": ticketSource("design", "mvp"),
        "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Second.
`,
      },
      {},
      { "mvp.md": TRAIL_MAP },
    );
    const result = await captureRun(({ stdout, stderr }) =>
      main(["close", "a1b2c3", "--confirm"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      `deleted ${root}/.bearing/tickets/a1b2c3-first.md\n` +
        `stripped a1b2c3 from ${root}/.bearing/tickets/b1c2d3-second.md\n`,
    );
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(true);
    await expect(readFile(join(root, ".bearing/tickets/b1c2d3-second.md"), "utf8")).resolves.toBe(`---
type: build
---

Second.
`);
  });

  it("refuses a design close when its map has no trail row", async () => {
    const root = join(fixtureRoot, "close-design-no-row");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("design", "mvp") });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("project mvp has no trail row for it");
    expect(result.stderr).not.toContain("--confirm");
    await expect(missing(join(root, ".bearing/tickets/a1b2c3-first.md"))).resolves.toBe(false);
  });

  it("refuses a design close when its trail outcome is empty", async () => {
    const root = join(fixtureRoot, "close-design-empty-outcome");
    const map = TRAIL_MAP.replace("[row](outcome)", "   ");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("design", "mvp") }, {}, { "mvp.md": map });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("trail row in project mvp has an empty outcome");
  });

  it("refuses a design close when its project has no map", async () => {
    const root = join(fixtureRoot, "close-design-no-map");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("design", "missing") });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("no map carries project missing");
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

  it("deletes a map on the first invocation and edits no other file", async () => {
    const root = join(fixtureRoot, "close-map");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" }, { "mvp.md": VALID_MAP });
    const backlogPath = join(root, ".bearing/backlog/c1d2e3-captured.md");
    const result = await captureRun(({ stdout, stderr }) => main(["close", "--map", "mvp"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`deleted map ${root}/.bearing/maps/mvp.md\n`);
    await expect(missing(join(root, ".bearing/maps/mvp.md"))).resolves.toBe(true);
    await expect(readFile(backlogPath, "utf8")).resolves.toBe("# Captured\n");
  });

  it("refuses a map close while tickets name it and deletes nothing", async () => {
    const root = join(fixtureRoot, "close-map-with-tickets");
    const tickets = {
      "a1b2c3-build.md": ticketSource("build", "mvp"),
      "b1c2d3-design.md": ticketSource("design", "mvp"),
    };
    await createTracker(root, tickets);
    const result = await captureRun(({ stdout, stderr }) => main(["close", "--map", "mvp"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('cannot close map "mvp": tickets still name it: a1b2c3, b1c2d3');
    await expect(missing(join(root, ".bearing/maps/mvp.md"))).resolves.toBe(false);
    await expect(readdir(join(root, ".bearing/tickets")).then((names) => names.sort())).resolves.toEqual(
      Object.keys(tickets).sort(),
    );
  });

  it("requires a map's exact filename stem and names the maps that exist", async () => {
    const root = join(fixtureRoot, "close-map-missing");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP, "other.md": VALID_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "--map", "mv"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('no map named "mv"; maps: mvp, other');
    await expect(readdir(join(root, ".bearing/maps"))).resolves.toEqual(["mvp.md", "other.md"]);
  });

  it("refuses repeated map targets rather than choosing one", async () => {
    const root = join(fixtureRoot, "close-map-repeated");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP, "other.md": VALID_MAP });
    const result = await captureRun(({ stdout, stderr }) =>
      main(["close", "--map", "mvp", "--map", "other"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("USAGE");
    expect(result.stderr).toContain('Invalid value for flag --map: "2 occurrences". Expected: at most 1 value');
    await expect(readdir(join(root, ".bearing/maps"))).resolves.toEqual(["mvp.md", "other.md"]);
  });

  it("never resolves a positional id as a map name", async () => {
    const root = join(fixtureRoot, "close-map-positional");
    await createTracker(root, {}, {}, { "a1b2c3.md": VALID_MAP });
    const result = await captureRun(({ stdout, stderr }) => main(["close", "a1b2c3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('no item matches id prefix "a1b2c3"');
    await expect(missing(join(root, ".bearing/maps/a1b2c3.md"))).resolves.toBe(false);
  });

  it("emits a map close result as JSON", async () => {
    const root = join(fixtureRoot, "close-map-json");
    await createTracker(root, {}, {}, { "mvp.md": VALID_MAP });
    const result = await captureRun(({ stdout, stderr }) =>
      main(["close", "--map", "mvp", "--json"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ project: "mvp", removed: `${root}/.bearing/maps/mvp.md` });
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

  it("emits what it deleted as JSON with the global --json", async () => {
    const root = join(fixtureRoot, "rm-json");
    await createTracker(root, {
      "a1b2c3-first.md": ticketSource("build"),
      "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Second.
`,
    });
    const result = await captureRun(({ stdout, stderr }) => main(["rm", "a1b2c3", "--json"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      id: "a1b2c3",
      removed: `${root}/.bearing/tickets/a1b2c3-first.md`,
      rewrote: [`${root}/.bearing/tickets/b1c2d3-second.md`],
    });
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

describe("retitle", () => {
  it("renames only the resolved ticket immediately and preserves its bytes", async () => {
    const root = join(fixtureRoot, "retitle-ticket");
    const source = "---\r\ntype: build\r\n---\r\n\r\n# Original title\r\n\r\nBody.\r\n";
    const other = ticketSource("build");
    await createTracker(root, { "a1b2c3-original-title.md": source, "b1c2d3-other.md": other });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["retitle", "a1b", "A better title"], stdout, stderr, root),
    );

    const from = join(root, ".bearing/tickets/a1b2c3-original-title.md");
    const to = join(root, ".bearing/tickets/a1b2c3-a-better-title.md");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`renamed ${from} to ${to}\n`);
    await expect(missing(from)).resolves.toBe(true);
    await expect(readFile(to, "utf8")).resolves.toBe(source);
    await expect(readFile(join(root, ".bearing/tickets/b1c2d3-other.md"), "utf8")).resolves.toBe(other);
  });

  it("preserves ticket bytes that are not valid UTF-8", async () => {
    const root = join(fixtureRoot, "retitle-invalid-utf8");
    await createTracker(root, { "a1b2c3-original-title.md": ticketSource("build") });
    const from = join(root, ".bearing/tickets/a1b2c3-original-title.md");
    const to = join(root, ".bearing/tickets/a1b2c3-a-better-title.md");
    const bytes = new Uint8Array([...new TextEncoder().encode(ticketSource("build")), 0xff, 0xfe]);
    await writeFile(from, bytes);

    const result = await captureRun(({ stdout, stderr }) =>
      main(["retitle", "a1b2c3", "A better title"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    await expect(readFile(to)).resolves.toEqual(Buffer.from(bytes));
  });

  it("succeeds without changing the file when the title derives the current slug", async () => {
    const root = join(fixtureRoot, "retitle-no-op");
    const source = ticketSource("build");
    await createTracker(root, { "a1b2c3-original-title.md": source });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["retitle", "a1b2c3", "Original title!"], stdout, stderr, root),
    );

    const path = join(root, ".bearing/tickets/a1b2c3-original-title.md");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`unchanged ${path}\n`);
    await expect(readFile(path, "utf8")).resolves.toBe(source);
  });

  it("exits 1 for an ambiguous prefix and names the candidates", async () => {
    const root = join(fixtureRoot, "retitle-ambiguous");
    await createTracker(root, {
      "a1b2c3-one.md": ticketSource("build"),
      "a2b3c4-two.md": ticketSource("build"),
    });

    const result = await captureRun(({ stdout, stderr }) => main(["retitle", "a", "New title"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('ambiguous id prefix "a": a1b2c3, a2b3c4');
  });

  it("emits the applied rename as JSON with --json", async () => {
    const root = join(fixtureRoot, "retitle-json");
    await createTracker(root, { "a1b2c3-original-title.md": ticketSource("build") });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["retitle", "a1b2c3", "A better title", "--json"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      id: "a1b2c3",
      slug: "a-better-title",
      from: `${root}/.bearing/tickets/a1b2c3-original-title.md`,
      to: `${root}/.bearing/tickets/a1b2c3-a-better-title.md`,
      changed: true,
    });
  });
});

describe("triage", () => {
  it("promotes a backlog item to a projectless build ticket with --ticket, id and body unchanged", async () => {
    const root = join(fixtureRoot, "triage-ticket");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n\nBody.\n" });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["triage", "c1d2e3", "--ticket"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`promoted c1d2e3 to ${root}/.bearing/tickets/c1d2e3-captured.md\n`);
    await expect(missing(join(root, ".bearing/backlog/c1d2e3-captured.md"))).resolves.toBe(true);
    await expect(readFile(join(root, ".bearing/tickets/c1d2e3-captured.md"), "utf8")).resolves.toBe(`---
type: build
---

# Captured

Body.
`);
  });

  it("promotes a backlog item into a named map with --to, adding only frontmatter", async () => {
    const root = join(fixtureRoot, "triage-to");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n\nBody.\n" });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["triage", "c1d2e3", "--to", "mvp"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`promoted c1d2e3 to ${root}/.bearing/tickets/c1d2e3-captured.md\n`);
    await expect(missing(join(root, ".bearing/backlog/c1d2e3-captured.md"))).resolves.toBe(true);
    await expect(readFile(join(root, ".bearing/tickets/c1d2e3-captured.md"), "utf8")).resolves.toBe(`---
type: build
project: mvp
---

# Captured

Body.
`);
  });

  it("resolves an unambiguous id prefix", async () => {
    const root = join(fixtureRoot, "triage-prefix");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });

    const result = await captureRun(({ stdout, stderr }) => main(["triage", "c1d", "--ticket"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`promoted c1d2e3 to ${root}/.bearing/tickets/c1d2e3-captured.md\n`);
  });

  it("deletes the backlog item with --drop", async () => {
    const root = join(fixtureRoot, "triage-drop");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });

    const result = await captureRun(({ stdout, stderr }) => main(["triage", "c1d2e3", "--drop"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`deleted ${root}/.bearing/backlog/c1d2e3-captured.md\n`);
    await expect(missing(join(root, ".bearing/backlog/c1d2e3-captured.md"))).resolves.toBe(true);
  });

  it("exits 1 for --to naming a map no file carries, names the maps, and deletes nothing", async () => {
    const root = join(fixtureRoot, "triage-missing-project");
    await createTracker(
      root,
      {},
      { "c1d2e3-captured.md": "# Captured\n" },
      { "mvp.md": VALID_MAP, "other.md": SECOND_MAP },
    );

    const result = await captureRun(({ stdout, stderr }) =>
      main(["triage", "c1d2e3", "--to", "missing"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('no map for project "missing"; maps: mvp, other');
    await expect(readFile(join(root, ".bearing/backlog/c1d2e3-captured.md"), "utf8")).resolves.toBe("# Captured\n");
  });

  it("exits 1 triaging an id that is already a ticket, saying so", async () => {
    const root = join(fixtureRoot, "triage-ticket-item");
    await createTracker(root, { "a1b2c3-first.md": ticketSource("build") }, { "c1d2e3-captured.md": "# Captured\n" });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["triage", "a1b2c3", "--ticket"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("cannot triage a1b2c3: it is already a ticket");
    await expect(readFile(join(root, ".bearing/tickets/a1b2c3-first.md"), "utf8")).resolves.toBe(ticketSource("build"));
  });

  it("exits 1 when two verdict flags are given together, and deletes nothing", async () => {
    const root = join(fixtureRoot, "triage-two-verdicts");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["triage", "c1d2e3", "--ticket", "--drop"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--ticket");
    expect(result.stderr).toContain("--drop");
    await expect(readFile(join(root, ".bearing/backlog/c1d2e3-captured.md"), "utf8")).resolves.toBe("# Captured\n");
  });

  it("exits 1 when no verdict flag is given, and deletes nothing", async () => {
    const root = join(fixtureRoot, "triage-no-verdict");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });

    const result = await captureRun(({ stdout, stderr }) => main(["triage", "c1d2e3"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("verdict");
    await expect(readFile(join(root, ".bearing/backlog/c1d2e3-captured.md"), "utf8")).resolves.toBe("# Captured\n");
  });

  it("emits the applied verdict as JSON with --json", async () => {
    const root = join(fixtureRoot, "triage-json");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["triage", "c1d2e3", "--to", "mvp", "--json"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      id: "c1d2e3",
      slug: "captured",
      verdict: "project",
      from: `${root}/.bearing/backlog/c1d2e3-captured.md`,
      to: `${root}/.bearing/tickets/c1d2e3-captured.md`,
      project: "mvp",
    });
  });

  it("emits a drop as JSON without a destination", async () => {
    const root = join(fixtureRoot, "triage-drop-json");
    await createTracker(root, {}, { "c1d2e3-captured.md": "# Captured\n" });

    const result = await captureRun(({ stdout, stderr }) =>
      main(["triage", "c1d2e3", "--drop", "--json"], stdout, stderr, root),
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      id: "c1d2e3",
      slug: "captured",
      verdict: "drop",
      from: `${root}/.bearing/backlog/c1d2e3-captured.md`,
    });
  });

  it("describes the verdict flags in --help", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["triage", "--help"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--ticket");
    expect(result.stdout).toContain("--to");
    expect(result.stdout).toContain("--drop");
  });

  it("exits 1 for a prefix matching nothing", async () => {
    const root = join(fixtureRoot, "triage-nomatch");
    await createTracker(root);

    const result = await captureRun(({ stdout, stderr }) => main(["triage", "zzzz", "--ticket"], stdout, stderr, root));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain('no item matches id prefix "zzzz"');
  });
});

describe("completion", () => {
  it("writes a bash completion script to stdout and exits 0", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["completion", "bash"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("###-begin-bearing-completions-###");
    expect(result.stdout).toContain("_bearing()");
    expect(result.stdout.endsWith("\n")).toBe(true);
  });

  it("generates a script for every shell its help text names", async () => {
    for (const shell of ["bash", "zsh", "fish"]) {
      const result = await captureRun(({ stdout, stderr }) => main(["completion", shell], stdout, stderr, fixtureRoot));

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.length).toBeGreaterThan(0);
    }
  });

  it("covers every command the binary exposes, with no hand-maintained list", async () => {
    const help = await captureRun(({ stdout, stderr }) => main(["--help"], stdout, stderr, fixtureRoot));
    const lines = help.stdout.split("\n");
    const names = lines
      .slice(lines.indexOf("SUBCOMMANDS") + 1)
      .map((line) => line.trim().split(/\s+/)[0] ?? "")
      .filter((name) => /^[a-z]+$/.test(name));

    expect(names.length).toBeGreaterThan(0);
    const script = await captureRun(({ stdout, stderr }) => main(["completion", "bash"], stdout, stderr, fixtureRoot));
    for (const name of names) {
      expect(script.stdout).toContain(`_bearing_${name}`);
    }
  });

  it("never names the flag that applies a design close in the generated output", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["completion", "bash"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("confirm");
  });

  it("names the command that exists, not a --completions built-in flag, in its install comment", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["completion", "bash"], stdout, stderr, fixtureRoot));

    expect(result.stdout).toContain("bearing completion bash >> ~/.bashrc");
    expect(result.stdout).not.toContain("--completions");
  });

  it("writes no file and creates nothing", async () => {
    const root = join(fixtureRoot, "completion-no-writes");
    await createTracker(root);
    const before = await readdir(root).then((entries) => entries.sort());

    const result = await captureRun(({ stdout, stderr }) => main(["completion", "bash"], stdout, stderr, root));

    expect(result.exitCode).toBe(0);
    expect((await readdir(root)).sort()).toEqual(before);
  });

  it("exits 1 with a missing shell, naming the shells that are supported", async () => {
    const result = await captureRun(({ stdout, stderr }) => main(["completion"], stdout, stderr, fixtureRoot));

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("bash | zsh | fish");
  });

  it("exits 1 with an unsupported shell, naming the shells that are supported", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["completion", "powershell"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("bash");
    expect(result.stderr).toContain("zsh");
    expect(result.stderr).toContain("fish");
  });

  it("emits the script as a JSON value with the global --json", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["completion", "zsh", "--json"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout) as { shell: string; script: string };
    expect(parsed.shell).toBe("zsh");
    expect(parsed.script).toContain("###-begin-bearing-completions-###");
  });

  it("names the supported shells in its help text", async () => {
    const result = await captureRun(({ stdout, stderr }) =>
      main(["completion", "--help"], stdout, stderr, fixtureRoot),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("bash | zsh | fish");
  });
});
