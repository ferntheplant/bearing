import { Effect, FileSystem, Layer, Path, PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  applySetup,
  digestSkillTree,
  OWNERSHIP_MARKER_FILE,
  planSetup,
  resolveSetupDestination,
  SKILL_DIRECTORY,
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

class Harness {
  readonly entries: Map<string, FsEntry>;

  constructor(entries: Readonly<Record<string, FsEntry>>) {
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
    Effect.sync(() => {
      harness.entries.set(normalize(path), directory());
    }),
  writeFileString: (path, data) =>
    Effect.sync(() => {
      harness.entries.set(normalize(path), file(data));
    }),
  remove: (path) =>
    Effect.sync(() => {
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

const ownedAgents = (skill = fixtureSkill, version = "0.0.0") => ({
  [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`]: file(skill.files[0]?.content ?? ""),
  [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/${OWNERSHIP_MARKER_FILE}`]: file(markerFile(version, skill)),
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
      skill: { tag: "install", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } },
    });
  });

  it("uses the sole existing convention", async () => {
    const plan = await runPlan({
      [`${WORKSPACE}/.claude/skills`]: directory(),
    });
    expect(plan.skill).toEqual({
      tag: "install",
      home: { label: ".claude/skills", path: `${WORKSPACE}/.claude/skills` },
    });
  });

  it("asks which destination when both conventions exist distinctly", async () => {
    const plan = await runPlan({
      [`${WORKSPACE}/.agents/skills`]: directory(),
      [`${WORKSPACE}/.claude/skills`]: directory(),
    });
    expect(plan.skill).toEqual({
      tag: "choose",
      candidates: [
        { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` },
        { label: ".claude/skills", path: `${WORKSPACE}/.claude/skills` },
      ],
    });
  });

  it("treats a .claude -> .agents alias as one destination without a prompt", async () => {
    const plan = await runPlan({
      [`${WORKSPACE}/.agents`]: directory(),
      [`${WORKSPACE}/.agents/skills`]: directory(),
      [`${WORKSPACE}/.claude`]: link(`${WORKSPACE}/.agents`),
    });
    expect(plan.skill).toEqual({
      tag: "install",
      home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` },
    });
  });

  it("finds an owned installation before convention detection and updates an untouched tree", async () => {
    const plan = await runPlan(ownedAgents());
    expect(plan.skill).toEqual({
      tag: "update",
      home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` },
    });
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
      home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` },
    });
  });

  it("skips an owned installation that gained a non-file entry", async () => {
    const plan = await runPlan({
      ...ownedAgents(),
      [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/extra`]: link("/somewhere"),
    });
    expect(plan.skill).toEqual({ tag: "skip", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } });
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

  it("refuses two physical owned installations", async () => {
    await expect(
      runPlan({
        ...ownedAgents(),
        [`${WORKSPACE}/.claude/skills/${SKILL_DIRECTORY}/SKILL.md`]: file("# Skill\n"),
        [`${WORKSPACE}/.claude/skills/${SKILL_DIRECTORY}/${OWNERSHIP_MARKER_FILE}`]: file(
          markerFile("0.0.0", fixtureSkill),
        ),
      }),
    ).rejects.toMatchObject({
      _tag: "SkillRefusalError",
      reason: "multiple-owned",
    });
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

describe("resolveSetupDestination", () => {
  it("resolves a choose plan to the chosen convention", () => {
    const plan = {
      workingDirectory: WORKSPACE,
      tracker: "create" as const,
      skill: {
        tag: "choose" as const,
        candidates: [
          { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` },
          { label: ".claude/skills", path: `${WORKSPACE}/.claude/skills` },
        ],
      },
    };
    expect(resolveSetupDestination(plan, ".claude/skills")).toEqual({
      ...plan,
      skill: { tag: "install", home: { label: ".claude/skills", path: `${WORKSPACE}/.claude/skills` } },
    });
  });

  it("rejects a label that is not a candidate", () => {
    const plan = {
      workingDirectory: WORKSPACE,
      tracker: "create" as const,
      skill: {
        tag: "choose" as const,
        candidates: [{ label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` }],
      },
    };
    expect(() => resolveSetupDestination(plan, ".agents")).toThrow("no convention named .agents");
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
            skill: { tag: "install", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } },
          },
          fixtureSkill,
        ),
        layer(harness),
      ),
    );

    expect(outcome).toEqual({
      tag: "installed",
      home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` },
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

  it("replaces the whole tree on an update, removing stale files", async () => {
    const harness = new Harness(ownedAgents());
    const outcome = await Effect.runPromise(
      Effect.provide(
        applySetup(
          {
            workingDirectory: WORKSPACE,
            tracker: "leave",
            skill: { tag: "update", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } },
          },
          fixtureSkill,
        ),
        layer(harness),
      ),
    );

    expect(outcome).toEqual({ tag: "updated", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } });
    expect(harness.entries.has(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`)).toBe(true);
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
            skill: { tag: "skip", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } },
          },
          fixtureSkill,
        ),
        layer(harness),
      ),
    );

    expect(outcome).toEqual({ tag: "skipped", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } });
    expect(harness.entries.get(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/SKILL.md`)).toEqual(file("# Edited\n"));
  });

  it("removes a stale installed file that is not part of the packaged tree", async () => {
    const stale = {
      ...ownedAgents(),
      [`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/references/old.md`]: file("# Old reference\n"),
    };
    const harness = new Harness(stale);
    const updatedSkill = {
      version: "0.0.0",
      files: [
        { path: "SKILL.md", content: "# Skill\n" },
        { path: "references/new.md", content: "# New reference\n" },
      ],
    };
    await Effect.runPromise(
      Effect.provide(
        applySetup(
          {
            workingDirectory: WORKSPACE,
            tracker: "leave",
            skill: { tag: "update", home: { label: ".agents/skills", path: `${WORKSPACE}/.agents/skills` } },
          },
          updatedSkill,
        ),
        layer(harness),
      ),
    );

    expect(harness.entries.has(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/references/old.md`)).toBe(false);
    expect(harness.entries.get(`${WORKSPACE}/.agents/skills/${SKILL_DIRECTORY}/references/new.md`)).toEqual(
      file("# New reference\n"),
    );
  });
});
