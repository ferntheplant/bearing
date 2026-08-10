import { Effect, FileSystem, Layer, Path, PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  applySetup,
  digestSkillTree,
  OWNERSHIP_MARKER_FILE,
  planSetup,
  SKILL_DIRECTORY,
  SKILL_HOME_LABEL,
} from "#src/setup.ts";

const WORKSPACE = "/workspace";

type FsEntry =
  | { readonly type: "directory" }
  | { readonly type: "file"; readonly content: string }
  | { readonly type: "link"; readonly target: string };

const directory = (): FsEntry => ({ type: "directory" });
const file = (content: string): FsEntry => ({ type: "file", content });
const link = (target: string): FsEntry => ({ type: "link", target });

const normalize = (path: string): string => {
  const segments = path.split("/").filter((segment) => segment !== "" && segment !== ".");
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      out.pop();
    } else {
      out.push(segment);
    }
  }
  return out.length === 0 ? "/" : `/${out.join("/")}`;
};

const dirname = (path: string): string => {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "/" : path.slice(0, index);
};

const notFound = (method: string, path: string) =>
  PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method, pathOrDescriptor: path });

const invalid = (method: string, path: string) =>
  PlatformError.systemError({ _tag: "InvalidData", module: "FileSystem", method, pathOrDescriptor: path });

interface InjectedFailure {
  readonly operation: "make-directory" | "write-file" | "remove";
  readonly path: string;
}

class Harness {
  readonly entries: Map<string, FsEntry>;

  constructor(
    entries: Readonly<Record<string, FsEntry>>,
    readonly failure?: InjectedFailure,
    readonly afterMakeDirectory?: (path: string) => void,
  ) {
    this.entries = new Map();
    for (const [path, entry] of Object.entries(entries)) {
      this.entries.set(normalize(path), entry);
    }
    for (const path of this.entries.keys()) {
      let parent = dirname(path);
      while (parent !== "/") {
        if (!this.entries.has(parent)) {
          this.entries.set(parent, directory());
        }
        parent = dirname(parent);
      }
    }
  }

  /** Resolves symlinks along every component, node-style. */
  resolve(path: string): string {
    const segments = normalize(path).split("/").filter(Boolean);
    let resolved = "/";
    for (const segment of segments) {
      const candidate = resolved === "/" ? `/${segment}` : `${resolved}/${segment}`;
      const entry = this.entries.get(candidate);
      if (entry?.type === "link") {
        const target = entry.target ?? "";
        const linked = target.startsWith("/") ? target : `${dirname(candidate)}/${target}`;
        resolved = this.resolve(linked);
      } else {
        resolved = candidate;
      }
    }
    return resolved;
  }

  fails(operation: InjectedFailure["operation"], path: string): boolean {
    return this.failure?.operation === operation && normalize(this.failure.path) === normalize(path);
  }
}

const makeMethods = (harness: Harness): Partial<FileSystem.FileSystem> => ({
  exists: (path) =>
    Effect.sync(() => {
      try {
        return harness.entries.has(harness.resolve(path));
      } catch {
        return false;
      }
    }),
  stat: (path) =>
    Effect.gen(function* () {
      const physical = yield* Effect.sync(() => harness.resolve(path));
      const entry = harness.entries.get(physical);
      if (entry === undefined) {
        return yield* Effect.fail(notFound("stat", path));
      }
      return {
        type: entry.type === "directory" ? "Directory" : entry.type === "file" ? "File" : entry.type,
      } as FileSystem.File.Info;
    }),
  readDirectory: (path) =>
    Effect.gen(function* () {
      const physical = yield* Effect.sync(() => harness.resolve(path));
      const entry = harness.entries.get(physical);
      if (entry === undefined || entry.type !== "directory") {
        return yield* Effect.fail(notFound("readDirectory", path));
      }
      const prefix = physical === "/" ? "/" : `${physical}/`;
      const names = new Set<string>();
      for (const key of harness.entries.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          if (rest.length > 0 && !rest.includes("/")) {
            names.add(rest);
          }
        }
      }
      return [...names];
    }),
  readFileString: (path) =>
    Effect.gen(function* () {
      const physical = yield* Effect.sync(() => harness.resolve(path));
      const entry = harness.entries.get(physical);
      if (entry === undefined || entry.type !== "file") {
        return yield* Effect.fail(notFound("readFileString", path));
      }
      return entry.content;
    }),
  readLink: (path) =>
    Effect.gen(function* () {
      const entry = harness.entries.get(normalize(path));
      if (entry === undefined) {
        return yield* Effect.fail(notFound("readLink", path));
      }
      if (entry.type !== "link") {
        return yield* Effect.fail(invalid("readLink", path));
      }
      return entry.target;
    }),
  makeDirectory: (path) =>
    harness.fails("make-directory", path)
      ? Effect.fail(invalid("makeDirectory", path))
      : Effect.sync(() => {
          harness.entries.set(normalize(path), directory());
          harness.afterMakeDirectory?.(normalize(path));
        }),
  writeFileString: (path, data) =>
    harness.fails("write-file", path)
      ? Effect.fail(invalid("writeFileString", path))
      : Effect.sync(() => {
          harness.entries.set(normalize(path), file(data));
        }),
  remove: (path) =>
    harness.fails("remove", path)
      ? Effect.fail(invalid("remove", path))
      : Effect.sync(() => {
          const normalized = normalize(path);
          harness.entries.delete(normalized);
          for (const key of harness.entries.keys()) {
            if (key.startsWith(`${normalized}/`)) {
              harness.entries.delete(key);
            }
          }
        }),
});

const layer = (harness: Harness) => Layer.merge(FileSystem.layerNoop(makeMethods(harness)), Path.layer);

const runPlan = (entries: Readonly<Record<string, FsEntry>>) => {
  const harness = new Harness(entries);
  return Effect.runPromise(Effect.provide(planSetup(WORKSPACE), layer(harness)));
};

const fixtureSkill = {
  version: "0.0.0",
  files: [{ path: "SKILL.md", content: "# Skill\n" }],
};

const marker = (version: string, skill: typeof fixtureSkill) => ({
  version,
  digest: digestSkillTree(skill.files),
});

const markerFile = (version: string, skill: typeof fixtureSkill) =>
  `${JSON.stringify(marker(version, skill), null, 2)}\n`;

const ownedAgents = (skill = fixtureSkill, version = "0.0.0"): Record<string, FsEntry> => ({
  ...Object.fromEntries(
    skill.files.map((skillFile) => [
      `${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/${skillFile.path}`,
      file(skillFile.content),
    ]),
  ),
  [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/${OWNERSHIP_MARKER_FILE}`]: file(markerFile(version, skill)),
});

const skillHome = { label: SKILL_HOME_LABEL, path: `${WORKSPACE}/.agents/skills` };

const updateDecision = (skill = fixtureSkill) => ({
  tag: "update" as const,
  home: skillHome,
  expectedDigest: digestSkillTree(skill.files),
});

describe("digestSkillTree", () => {
  it("is order-independent and sensitive to path and content", () => {
    const first = digestSkillTree([
      { path: "a.md", content: "one" },
      { path: "b.md", content: "two" },
    ]);
    const reversed = digestSkillTree([
      { path: "b.md", content: "two" },
      { path: "a.md", content: "one" },
    ]);
    expect(first).toBe(reversed);
    expect(digestSkillTree([{ path: "a.md", content: "one" }])).not.toBe(first);
    expect(digestSkillTree([{ path: "a.md", content: "1ne" }])).not.toBe(
      digestSkillTree([{ path: "a.md", content: "one" }]),
    );
  });
});

describe("planSetup", () => {
  it("plans a first installation into the default .agents/skills when nothing exists", async () => {
    const plan = await runPlan({});
    expect(plan).toEqual({
      workingDirectory: WORKSPACE,
      tracker: "create",
      skill: { tag: "install", home: skillHome },
    });
  });

  it("ignores .claude/skills and installs at the fixed .agents/skills home", async () => {
    const plan = await runPlan({
      [`${WORKSPACE}/.claude/skills`]: directory(),
    });
    expect(plan.skill).toEqual({
      tag: "install",
      home: skillHome,
    });
  });

  it("updates an untouched owned installation", async () => {
    const plan = await runPlan(ownedAgents());
    expect(plan.skill).toEqual(updateDecision());
  });

  it("skips an owned installation whose tree no longer matches the recorded digest", async () => {
    const plan = await runPlan({
      [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`]: file("# Edited\n"),
      [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/${OWNERSHIP_MARKER_FILE}`]: file(
        markerFile("0.0.0", fixtureSkill),
      ),
    });
    expect(plan.skill).toEqual({
      tag: "skip",
      home: skillHome,
    });
  });

  it("skips an owned installation that gained a non-file entry", async () => {
    const plan = await runPlan({
      ...ownedAgents(),
      [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/extra`]: link("/somewhere"),
    });
    expect(plan.skill).toEqual({ tag: "skip", home: skillHome });
  });

  it("treats a nested ownership-marker name as an added local file", async () => {
    const plan = await runPlan({
      ...ownedAgents(),
      [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/references/${OWNERSHIP_MARKER_FILE}`]: file("local\n"),
    });
    expect(plan.skill).toEqual({ tag: "skip", home: skillHome });
  });

  it("refuses an unowned same-name collision before writing anything", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`]: file("# User's own skill\n"),
      }),
    ).rejects.toMatchObject({
      _tag: "SkillRefusalError",
      reason: "unowned-collision",
    });
  });

  it("refuses a malformed ownership marker", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`]: file("# Skill\n"),
        [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/${OWNERSHIP_MARKER_FILE}`]: file("not json\n"),
      }),
    ).rejects.toMatchObject({
      _tag: "SkillRefusalError",
      reason: "malformed-marker",
    });
  });

  it("refuses a marker missing its fields as malformed", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`]: file("# Skill\n"),
        [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/${OWNERSHIP_MARKER_FILE}`]: file('{ "version": "0.0.0" }\n'),
      }),
    ).rejects.toMatchObject({ _tag: "SkillRefusalError", reason: "malformed-marker" });
  });

  it("refuses a symbolic link at .agents without following it", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.agents`]: link("/outside"),
        "/outside/skills/bearing-wayfinder/SKILL.md": file("# Outside\n"),
      }),
    ).rejects.toMatchObject({
      _tag: "SkillRefusalError",
      reason: "symbolic-link",
    });
  });

  it("refuses a symbolic link at .agents/skills without following it", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.agents`]: directory(),
        [`${WORKSPACE}/.agents/skills`]: link("/outside"),
        "/outside/bearing-wayfinder/SKILL.md": file("# Outside\n"),
      }),
    ).rejects.toMatchObject({ _tag: "SkillRefusalError", reason: "symbolic-link" });
  });

  it("refuses a symbolic link at the skill root without following it", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}`]: link("/outside"),
        "/outside/SKILL.md": file("# Outside\n"),
      }),
    ).rejects.toMatchObject({ _tag: "SkillRefusalError", reason: "symbolic-link" });
  });

  it("treats a .bearing symlink as a collision", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.bearing`]: link(`${WORKSPACE}/elsewhere`),
      }),
    ).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
      message: expect.stringContaining(".bearing must not be a symbolic link"),
    });
  });

  it("treats a malformed existing tracker as an error rather than overwriting it", async () => {
    await expect(
      runPlan({
        [`${WORKSPACE}/.bearing`]: directory(),
      }),
    ).rejects.toMatchObject({ _tag: "MalformedTrackerError" });
  });

  it("keeps an existing valid tracker rather than recreating it", async () => {
    const plan = await runPlan({
      [`${WORKSPACE}/.bearing/backlog`]: directory(),
      [`${WORKSPACE}/.bearing/tickets`]: directory(),
      [`${WORKSPACE}/.bearing/maps`]: directory(),
    });
    expect(plan.tracker).toBe("leave");
  });
});

describe("applySetup", () => {
  it("creates the tracker and writes the skill tree and marker", async () => {
    const harness = new Harness({});
    const outcome = await Effect.runPromise(
      Effect.provide(
        applySetup(
          {
            workingDirectory: WORKSPACE,
            tracker: "create",
            skill: { tag: "install", home: skillHome },
          },
          fixtureSkill,
        ),
        layer(harness),
      ),
    );

    expect(outcome).toEqual({
      tag: "installed",
      home: skillHome,
      trackerCreated: true,
    });
    expect(harness.entries.has(`${WORKSPACE}/.bearing/backlog`)).toBe(true);
    expect(harness.entries.has(`${WORKSPACE}/.bearing/tickets`)).toBe(true);
    expect(harness.entries.has(`${WORKSPACE}/.bearing/maps`)).toBe(true);
    expect(harness.entries.get(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`)).toEqual(file("# Skill\n"));
    expect(
      JSON.parse(
        (
          harness.entries.get(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/${OWNERSHIP_MARKER_FILE}`) as {
            content: string;
          }
        ).content,
      ),
    ).toEqual(marker("0.0.0", fixtureSkill));
  });

  it("replaces the whole tree when a packaged path changes from a directory to a file", async () => {
    const oldSkill = {
      version: "0.0.0",
      files: [{ path: "node/child.md", content: "old\n" }],
    };
    const newSkill = {
      version: "0.0.1",
      files: [{ path: "node", content: "new\n" }],
    };
    const harness = new Harness(ownedAgents(oldSkill));
    const outcome = await Effect.runPromise(
      Effect.provide(
        applySetup(
          {
            workingDirectory: WORKSPACE,
            tracker: "leave",
            skill: updateDecision(oldSkill),
          },
          newSkill,
        ),
        layer(harness),
      ),
    );

    expect(outcome).toEqual({ tag: "updated", home: skillHome });
    expect(harness.entries.get(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/node`)).toEqual(file("new\n"));
    expect(harness.entries.has(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/node/child.md`)).toBe(false);
  });

  it("returns a skipped outcome without touching the installed tree", async () => {
    const edited = {
      ...ownedAgents(),
    };
    edited[`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`] = file("# Edited\n");
    const harness = new Harness(edited);
    const outcome = await Effect.runPromise(
      Effect.provide(
        applySetup(
          {
            workingDirectory: WORKSPACE,
            tracker: "leave",
            skill: { tag: "skip", home: skillHome },
          },
          fixtureSkill,
        ),
        layer(harness),
      ),
    );

    expect(outcome).toEqual({ tag: "skipped", home: skillHome });
    expect(harness.entries.get(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`)).toEqual(file("# Edited\n"));
  });

  it("rechecks an update plan and skips when the installed tree changed", async () => {
    const harness = new Harness(ownedAgents());
    const plan = await Effect.runPromise(Effect.provide(planSetup(WORKSPACE), layer(harness)));
    harness.entries.set(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`, file("# Edited after planning\n"));

    const outcome = await Effect.runPromise(Effect.provide(applySetup(plan, fixtureSkill), layer(harness)));

    expect(outcome).toEqual({ tag: "skipped", home: skillHome });
    expect(harness.entries.get(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`)).toEqual(
      file("# Edited after planning\n"),
    );
  });

  it("rechecks again after tracker creation before replacing the skill", async () => {
    const skillFile = `${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`;
    const harness = new Harness(ownedAgents(), undefined, (path) => {
      if (path === `${WORKSPACE}/.bearing/maps`) {
        harness.entries.set(skillFile, file("# Edited during tracker creation\n"));
      }
    });
    const plan = await Effect.runPromise(Effect.provide(planSetup(WORKSPACE), layer(harness)));

    const outcome = await Effect.runPromise(Effect.provide(applySetup(plan, fixtureSkill), layer(harness)));

    expect(outcome).toEqual({ tag: "skipped", home: skillHome });
    expect(harness.entries.get(skillFile)).toEqual(file("# Edited during tracker creation\n"));
  });

  it("reports a remove failure and leaves the old owned tree intact", async () => {
    const skillDirectory = `${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}`;
    const harness = new Harness(ownedAgents(), { operation: "remove", path: skillDirectory });

    await expect(
      Effect.runPromise(
        Effect.provide(
          applySetup({ workingDirectory: WORKSPACE, tracker: "leave", skill: updateDecision() }, fixtureSkill),
          layer(harness),
        ),
      ),
    ).rejects.toMatchObject({ _tag: "SetupWriteError", operation: "remove", path: skillDirectory });
    expect(harness.entries.get(`${skillDirectory}/SKILL.md`)).toEqual(file("# Skill\n"));
  });

  it("reports a make-directory failure after creating the tracker", async () => {
    const skillDirectory = `${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}`;
    const harness = new Harness({}, { operation: "make-directory", path: skillDirectory });

    await expect(
      Effect.runPromise(
        Effect.provide(
          applySetup(
            { workingDirectory: WORKSPACE, tracker: "create", skill: { tag: "install", home: skillHome } },
            fixtureSkill,
          ),
          layer(harness),
        ),
      ),
    ).rejects.toMatchObject({ _tag: "SetupWriteError", operation: "make-directory", path: skillDirectory });
    expect(harness.entries.has(`${WORKSPACE}/.bearing/backlog`)).toBe(true);
    expect(harness.entries.has(skillDirectory)).toBe(false);
  });

  it("reports a write failure with only the completed prefix left on disk", async () => {
    const oldSkill = {
      version: "0.0.0",
      files: [{ path: "old.md", content: "old\n" }],
    };
    const updatedSkill = {
      version: "0.0.1",
      files: [
        { path: "a.md", content: "first\n" },
        { path: "b.md", content: "second\n" },
      ],
    };
    const skillDirectory = `${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}`;
    const failedPath = `${skillDirectory}/b.md`;
    const harness = new Harness(ownedAgents(oldSkill), { operation: "write-file", path: failedPath });

    await expect(
      Effect.runPromise(
        Effect.provide(
          applySetup({ workingDirectory: WORKSPACE, tracker: "leave", skill: updateDecision(oldSkill) }, updatedSkill),
          layer(harness),
        ),
      ),
    ).rejects.toMatchObject({ _tag: "SetupWriteError", operation: "write-file", path: failedPath });

    expect(harness.entries.get(`${skillDirectory}/a.md`)).toEqual(file("first\n"));
    expect(harness.entries.has(`${skillDirectory}/b.md`)).toBe(false);
    expect(harness.entries.has(`${skillDirectory}/old.md`)).toBe(false);
    expect(harness.entries.has(`${skillDirectory}/${OWNERSHIP_MARKER_FILE}`)).toBe(false);
  });

  it("does not write through a symlink introduced after an install plan", async () => {
    const harness = new Harness({});
    const plan = await Effect.runPromise(Effect.provide(planSetup(WORKSPACE), layer(harness)));
    harness.entries.set(`${WORKSPACE}/.agents`, link("/outside"));
    harness.entries.set("/outside/untouched.md", file("outside\n"));

    await expect(
      Effect.runPromise(Effect.provide(applySetup(plan, fixtureSkill), layer(harness))),
    ).rejects.toMatchObject({ _tag: "SkillRefusalError", reason: "symbolic-link" });

    expect(harness.entries.get("/outside/untouched.md")).toEqual(file("outside\n"));
    expect(harness.entries.has(`${WORKSPACE}/.bearing`)).toBe(false);
  });
});
