import { Data, Effect, FileSystem, Path, Result } from "effect";

import {
  acquireTracker,
  requireValidTracker,
  MalformedTrackerError,
  TrackerReadError,
  type TrackerDiagnostic,
} from "./acquisition.ts";
import { sha256Hex } from "./sha256.ts";

export const SKILL_DIRECTORY = "wayfinder";
export const OWNERSHIP_MARKER_FILE = ".bearing-owner.json";

const TRACKER_DIRECTORIES = ["backlog", "tickets", "maps"] as const;

interface Convention {
  readonly label: string;
  readonly agentDirectory: string;
}

const CONVENTIONS: readonly Convention[] = [
  { label: ".agents/skills", agentDirectory: ".agents" },
  { label: ".claude/skills", agentDirectory: ".claude" },
];

export interface SkillFile {
  readonly path: string;
  readonly content: string;
}

export interface PackagedSkill {
  readonly version: string;
  readonly files: readonly SkillFile[];
}

export interface SkillHome {
  readonly label: string;
  readonly path: string;
}

export interface OwnershipMarker {
  readonly version: string;
  readonly digest: string;
}

export class SkillRefusalError extends Data.TaggedError("SkillRefusalError")<{
  readonly reason: "unowned-collision" | "malformed-marker" | "multiple-owned";
  readonly paths: readonly string[];
  readonly message: string;
}> {}

export class SetupWriteError extends Data.TaggedError("SetupWriteError")<{
  readonly operation: "make-directory" | "write-file" | "remove";
  readonly path: string;
  readonly message: string;
}> {}

export type SetupError = SkillRefusalError | TrackerReadError | MalformedTrackerError | SetupWriteError;

export type TrackerAction = "create" | "leave";

export type SkillDecision =
  | { readonly tag: "install"; readonly home: SkillHome }
  | { readonly tag: "update"; readonly home: SkillHome }
  | { readonly tag: "skip"; readonly home: SkillHome }
  | { readonly tag: "choose"; readonly candidates: readonly SkillHome[] };

export type ResolvedSkillDecision = Exclude<SkillDecision, { readonly tag: "choose" }>;

export interface SetupPlan {
  readonly workingDirectory: string;
  readonly tracker: TrackerAction;
  readonly skill: SkillDecision;
}

export interface ResolvedSetupPlan extends SetupPlan {
  readonly skill: ResolvedSkillDecision;
}

export type SetupOutcome =
  | { readonly tag: "installed"; readonly home: SkillHome; readonly trackerCreated: boolean }
  | { readonly tag: "updated"; readonly home: SkillHome }
  | { readonly tag: "skipped"; readonly home: SkillHome };

const readError = (operation: TrackerReadError["operation"], path: string, detail: string): TrackerReadError =>
  new TrackerReadError({
    operation,
    path,
    message: `cannot ${operation.replaceAll("-", " ")} ${path}: ${detail}`,
  });

const writeError = (operation: SetupWriteError["operation"], path: string, detail: string): SetupWriteError =>
  new SetupWriteError({
    operation,
    path,
    message: `cannot ${operation.replaceAll("-", " ")} ${path}: ${detail}`,
  });

const refusal = (reason: SkillRefusalError["reason"], paths: readonly string[]): SkillRefusalError =>
  new SkillRefusalError({
    reason,
    paths,
    message: refusalMessage(reason, paths),
  });

const refusalMessage = (reason: SkillRefusalError["reason"], paths: readonly string[]): string => {
  const listed = paths.join(", ");
  switch (reason) {
    case "unowned-collision":
      return `a skill named ${SKILL_DIRECTORY} already exists at ${listed} without a bearing ownership marker; refusing to overwrite it`;
    case "malformed-marker":
      return `the bearing ownership marker at ${listed} is malformed`;
    case "multiple-owned":
      return `multiple owned ${SKILL_DIRECTORY} installations found at ${listed}; refusing to choose one`;
  }
};

const structuralError = (path: string, message: string): MalformedTrackerError =>
  new MalformedTrackerError({
    diagnostics: [{ path, source: "structure", message } satisfies TrackerDiagnostic],
    message: `malformed tracker:\n${path}: ${message}`,
  });

type EntryKind = "directory" | "file" | "other" | "missing";

const statKind = (path: string): Effect.Effect<EntryKind, TrackerReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* Effect.result(fs.stat(path));
    if (Result.isFailure(result)) {
      if (result.failure.reason._tag === "NotFound") {
        return "missing";
      }
      return yield* Effect.fail(readError("stat", path, result.failure.message));
    }
    switch (result.success.type) {
      case "Directory":
        return "directory";
      case "File":
        return "file";
      default:
        return "other";
    }
  });

/**
 * Resolves symlinks along every path component. The final component may not exist; the
 * deepest existing prefix is resolved and the remaining tail is appended literally.
 */
const physicalPath = (target: string): Effect.Effect<string, TrackerReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const segments = path
      .resolve(target)
      .split(path.sep)
      .filter((segment) => segment.length > 0);
    let resolved = path.sep;
    for (const segment of segments) {
      const candidate = path.join(resolved, segment);
      const link = yield* Effect.result(fs.readLink(candidate));
      if (Result.isSuccess(link)) {
        const linked = path.isAbsolute(link.success)
          ? link.success
          : path.resolve(path.dirname(candidate), link.success);
        resolved = yield* physicalPath(linked);
      } else {
        resolved = candidate;
      }
    }
    return resolved;
  });

/**
 * The digest of a skill tree: SHA-256 over every file's path and content, in path order,
 * each terminated by a null byte so path and content boundaries stay unambiguous. The
 * ownership marker records this digest, and a re-run compares it against the digest of
 * the installed tree to tell an untouched installation from an edited one.
 */
export const digestSkillTree = (files: readonly SkillFile[]): string => {
  const parts: string[] = [];
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    parts.push(file.path, "\0", file.content, "\0");
  }
  return sha256Hex(parts.join(""));
};

const parseMarker = (source: string): OwnershipMarker | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const fields = parsed as Record<string, unknown>;
  if (typeof fields.version !== "string" || typeof fields.digest !== "string") {
    return undefined;
  }
  return { version: fields.version, digest: fields.digest };
};

const inspectTracker = (
  workingDirectory: string,
): Effect.Effect<TrackerAction, TrackerReadError | MalformedTrackerError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tracker = path.join(workingDirectory, ".bearing");
    const link = yield* Effect.result(fs.readLink(tracker));
    if (Result.isSuccess(link)) {
      return yield* Effect.fail(structuralError(tracker, ".bearing must not be a symbolic link"));
    }
    const kind = yield* statKind(tracker);
    if (kind === "missing") {
      return "create";
    }
    if (kind !== "directory") {
      return yield* Effect.fail(structuralError(tracker, ".bearing must be a directory"));
    }
    const observation = yield* acquireTracker(tracker);
    yield* requireValidTracker(observation);
    return "leave";
  });

interface InstalledTree {
  readonly files: readonly SkillFile[];
  readonly hasNonFile: boolean;
}

const readSkillTree = (
  skillDirectory: string,
): Effect.Effect<InstalledTree, TrackerReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const files: SkillFile[] = [];
    let hasNonFile = false;
    const walk = (directory: string): Effect.Effect<void, TrackerReadError, FileSystem.FileSystem | Path.Path> =>
      Effect.gen(function* () {
        const entries = yield* fs
          .readDirectory(directory)
          .pipe(Effect.mapError((error) => readError("read-directory", directory, error.message)));
        for (const entry of [...entries].sort()) {
          const entryPath = path.join(directory, entry);
          if (path.basename(entryPath) === OWNERSHIP_MARKER_FILE) {
            continue;
          }
          const info = yield* Effect.result(fs.stat(entryPath));
          if (Result.isFailure(info)) {
            hasNonFile = true;
            continue;
          }
          if (info.success.type === "File") {
            const content = yield* Effect.result(fs.readFileString(entryPath));
            if (Result.isFailure(content)) {
              hasNonFile = true;
              continue;
            }
            files.push({ path: path.relative(skillDirectory, entryPath), content: content.success });
          } else if (info.success.type === "Directory") {
            yield* walk(entryPath);
          } else {
            hasNonFile = true;
          }
        }
      });
    yield* walk(skillDirectory);
    return { files, hasNonFile };
  });

interface ConventionObservation {
  readonly label: string;
  readonly skillDirectory: string;
  readonly kind: "present" | "absent" | "collision";
}

const inspectConvention = (
  workingDirectory: string,
  convention: Convention,
): Effect.Effect<ConventionObservation, TrackerReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const skillDirectory = path.join(workingDirectory, convention.agentDirectory, "skills", SKILL_DIRECTORY);
    const kind = yield* statKind(skillDirectory);
    if (kind === "missing") {
      return { label: convention.label, skillDirectory, kind: "absent" };
    }
    if (kind !== "directory") {
      return { label: convention.label, skillDirectory, kind: "collision" };
    }
    const physical = yield* physicalPath(skillDirectory);
    return { label: convention.label, skillDirectory: physical, kind: "present" };
  });

type MarkerObservation =
  | { readonly tag: "owned"; readonly home: SkillHome; readonly marker: OwnershipMarker }
  | { readonly tag: "unowned"; readonly home: SkillHome; readonly skillDirectory: string }
  | { readonly tag: "malformed"; readonly home: SkillHome; readonly markerPath: string };

const inspectMarker = (
  home: SkillHome,
): Effect.Effect<MarkerObservation, TrackerReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const skillDirectory = path.join(home.path, SKILL_DIRECTORY);
    const markerPath = path.join(skillDirectory, OWNERSHIP_MARKER_FILE);
    const exists = yield* fs
      .exists(markerPath)
      .pipe(Effect.mapError((error) => readError("stat", markerPath, error.message)));
    if (!exists) {
      return { tag: "unowned", home, skillDirectory };
    }
    const source = yield* fs
      .readFileString(markerPath)
      .pipe(Effect.mapError((error) => readError("read-file", markerPath, error.message)));
    const marker = parseMarker(source);
    if (marker === undefined) {
      return { tag: "malformed", home, markerPath };
    }
    return { tag: "owned", home, marker };
  });

const planSkill = (
  workingDirectory: string,
): Effect.Effect<SkillDecision, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const observations = yield* Effect.forEach(CONVENTIONS, (convention) =>
      inspectConvention(workingDirectory, convention),
    );

    const collisions = observations.filter((observation) => observation.kind === "collision");
    if (collisions.length > 0) {
      return yield* Effect.fail(
        refusal(
          "unowned-collision",
          collisions.map((observation) => observation.skillDirectory),
        ),
      );
    }

    const present = new Map<string, ConventionObservation>();
    for (const observation of observations) {
      if (observation.kind === "present" && !present.has(observation.skillDirectory)) {
        present.set(observation.skillDirectory, observation);
      }
    }

    const owned: Extract<MarkerObservation, { readonly tag: "owned" }>[] = [];
    const unowned: Extract<MarkerObservation, { readonly tag: "unowned" }>[] = [];
    const malformed: Extract<MarkerObservation, { readonly tag: "malformed" }>[] = [];
    for (const observation of present.values()) {
      const home: SkillHome = { label: observation.label, path: path.dirname(observation.skillDirectory) };
      const marker = yield* inspectMarker(home);
      switch (marker.tag) {
        case "owned":
          owned.push(marker);
          break;
        case "unowned":
          unowned.push(marker);
          break;
        case "malformed":
          malformed.push(marker);
          break;
      }
    }

    if (malformed.length > 0) {
      return yield* Effect.fail(
        refusal(
          "malformed-marker",
          malformed.map((marker) => marker.markerPath),
        ),
      );
    }
    if (unowned.length > 0) {
      return yield* Effect.fail(
        refusal(
          "unowned-collision",
          unowned.map((marker) => marker.skillDirectory),
        ),
      );
    }
    if (owned.length > 1) {
      return yield* Effect.fail(
        refusal(
          "multiple-owned",
          owned.map((marker) => marker.home.path),
        ),
      );
    }
    if (owned.length === 1) {
      const only = owned[0];
      if (only === undefined) {
        throw new Error("internal error: exactly one owned installation was expected");
      }
      const installed = yield* readSkillTree(path.join(only.home.path, SKILL_DIRECTORY));
      if (installed.hasNonFile || digestSkillTree(installed.files) !== only.marker.digest) {
        return { tag: "skip", home: only.home };
      }
      return { tag: "update", home: only.home };
    }

    const homes: SkillHome[] = [];
    for (const convention of CONVENTIONS) {
      const homePath = path.join(workingDirectory, convention.agentDirectory, "skills");
      const kind = yield* statKind(homePath);
      if (kind === "directory") {
        const physical = yield* physicalPath(homePath);
        if (!homes.some((home) => home.path === physical)) {
          homes.push({ label: convention.label, path: physical });
        }
      }
    }
    if (homes.length === 0) {
      return {
        tag: "install",
        home: { label: ".agents/skills", path: path.join(workingDirectory, ".agents", "skills") },
      };
    }
    if (homes.length === 1) {
      const home = homes[0];
      if (home === undefined) {
        throw new Error("internal error: exactly one convention was expected");
      }
      return { tag: "install", home };
    }
    return { tag: "choose", candidates: homes };
  });

export const planSetup = (
  workingDirectory: string,
): Effect.Effect<SetupPlan, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const tracker = yield* inspectTracker(workingDirectory);
    const skill = yield* planSkill(workingDirectory);
    return { workingDirectory, tracker, skill };
  });

export const resolveSetupDestination = (plan: SetupPlan, label: string | undefined): ResolvedSetupPlan => {
  if (plan.skill.tag === "choose") {
    const chosen = plan.skill.candidates.find((candidate) => candidate.label === label);
    if (chosen === undefined) {
      throw new Error(`no convention named ${label}`);
    }
    return { ...plan, skill: { tag: "install", home: chosen } };
  }
  return { ...plan, skill: plan.skill };
};

const applySkill = (
  home: SkillHome,
  skill: PackagedSkill,
): Effect.Effect<void, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const skillDirectory = path.join(home.path, SKILL_DIRECTORY);
    yield* fs
      .makeDirectory(skillDirectory, { recursive: true })
      .pipe(Effect.mapError((error) => writeError("make-directory", skillDirectory, error.message)));

    const installed = yield* readSkillTree(skillDirectory);
    const packagedPaths = new Set(skill.files.map((file) => file.path));
    for (const file of installed.files) {
      if (!packagedPaths.has(file.path)) {
        const stalePath = path.join(skillDirectory, file.path);
        yield* fs
          .remove(stalePath, { recursive: true })
          .pipe(Effect.mapError((error) => writeError("remove", stalePath, error.message)));
      }
    }

    for (const file of skill.files) {
      const filePath = path.join(skillDirectory, file.path);
      yield* fs
        .makeDirectory(path.dirname(filePath), { recursive: true })
        .pipe(Effect.mapError((error) => writeError("make-directory", path.dirname(filePath), error.message)));
      yield* fs
        .writeFileString(filePath, file.content)
        .pipe(Effect.mapError((error) => writeError("write-file", filePath, error.message)));
    }

    const marker: OwnershipMarker = { version: skill.version, digest: digestSkillTree(skill.files) };
    const markerPath = path.join(skillDirectory, OWNERSHIP_MARKER_FILE);
    yield* fs
      .writeFileString(markerPath, `${JSON.stringify(marker, null, 2)}\n`)
      .pipe(Effect.mapError((error) => writeError("write-file", markerPath, error.message)));
  });

export const applySetup = (
  plan: ResolvedSetupPlan,
  skill: PackagedSkill,
): Effect.Effect<SetupOutcome, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    let trackerCreated = false;
    if (plan.tracker === "create") {
      for (const directory of TRACKER_DIRECTORIES) {
        const directoryPath = path.join(plan.workingDirectory, ".bearing", directory);
        yield* fs
          .makeDirectory(directoryPath, { recursive: true })
          .pipe(Effect.mapError((error) => writeError("make-directory", directoryPath, error.message)));
      }
      trackerCreated = true;
    }
    switch (plan.skill.tag) {
      case "install":
        yield* applySkill(plan.skill.home, skill);
        return { tag: "installed", home: plan.skill.home, trackerCreated };
      case "update":
        yield* applySkill(plan.skill.home, skill);
        return { tag: "updated", home: plan.skill.home };
      case "skip":
        return { tag: "skipped", home: plan.skill.home };
    }
  });
