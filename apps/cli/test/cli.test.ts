import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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
    writeFile(join(tracker, "maps", "mvp.md"), VALID_MAP),
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
