import { Data, Effect, FileSystem, Path, Result } from "effect";

import {
  acquireTracker,
  requireValidTracker,
  MalformedTrackerError,
  TrackerReadError,
  type TrackerDiagnostic,
} from "./acquisition.ts";
import { sha256Hex } from "./sha256.ts";

export const SKILL_DIRECTORY = "bearing-wayfinder";
export const OWNERSHIP_MARKER_FILE = ".bearing-owner.json";
export const SKILL_HOME_LABEL = ".agents/skills";

const TRACKER_DIRECTORIES = ["backlog", "tickets", "maps"] as const;

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
  readonly reason: "unowned-collision" | "malformed-marker" | "path-collision" | "symbolic-link" | "changed-after-plan";
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
  | { readonly tag: "update"; readonly home: SkillHome; readonly expectedDigest: string }
  | { readonly tag: "skip"; readonly home: SkillHome };

export interface SetupPlan {
  readonly workingDirectory: string;
  readonly tracker: TrackerAction;
  readonly skill: SkillDecision;
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
    case "path-collision":
      return `the bearing skill installation path is occupied by a non-directory at ${listed}`;
    case "symbolic-link":
      return `the bearing skill installation path must not contain a symbolic link: ${listed}`;
    case "changed-after-plan":
      return `the bearing skill installation changed after setup was planned: ${listed}`;
  }
};

const structuralError = (path: string, message: string): MalformedTrackerError =>
  new MalformedTrackerError({
    diagnostics: [{ kind: "parse", path, source: "structure", message } satisfies TrackerDiagnostic],
    message: `malformed tracker:\n${path}: ${message}`,
  });

type EntryKind = "directory" | "file" | "other" | "missing" | "symbolic-link";

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

const literalKind = (target: string): Effect.Effect<EntryKind, TrackerReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const link = yield* Effect.result(fs.readLink(target));
    if (Result.isSuccess(link)) {
      return "symbolic-link";
    }
    return yield* statKind(target);
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
          if (directory === skillDirectory && entry === OWNERSHIP_MARKER_FILE) {
            continue;
          }
          const kind = yield* literalKind(entryPath);
          if (kind === "file") {
            const content = yield* Effect.result(fs.readFileString(entryPath));
            if (Result.isFailure(content)) {
              hasNonFile = true;
              continue;
            }
            files.push({ path: path.relative(skillDirectory, entryPath), content: content.success });
          } else if (kind === "directory") {
            yield* walk(entryPath);
          } else {
            hasNonFile = true;
          }
        }
      });
    yield* walk(skillDirectory);
    return { files, hasNonFile };
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
    const kind = yield* literalKind(markerPath);
    if (kind === "missing") {
      return { tag: "unowned", home, skillDirectory };
    }
    if (kind !== "file") {
      return { tag: "malformed", home, markerPath };
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

type SkillObservation =
  | { readonly tag: "absent"; readonly home: SkillHome }
  | Extract<MarkerObservation, { readonly tag: "owned" | "unowned" | "malformed" }>;

const inspectSkill = (
  workingDirectory: string,
): Effect.Effect<SkillObservation, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const agentDirectory = path.join(workingDirectory, ".agents");
    const home: SkillHome = { label: SKILL_HOME_LABEL, path: path.join(agentDirectory, "skills") };
    const skillDirectory = path.join(home.path, SKILL_DIRECTORY);

    for (const directory of [agentDirectory, home.path]) {
      const kind = yield* literalKind(directory);
      if (kind === "symbolic-link") {
        return yield* Effect.fail(refusal("symbolic-link", [directory]));
      }
      if (kind === "missing") {
        return { tag: "absent", home };
      }
      if (kind !== "directory") {
        return yield* Effect.fail(refusal("path-collision", [directory]));
      }
    }

    const skillKind = yield* literalKind(skillDirectory);
    if (skillKind === "missing") {
      return { tag: "absent", home };
    }
    if (skillKind === "symbolic-link") {
      return yield* Effect.fail(refusal("symbolic-link", [skillDirectory]));
    }
    if (skillKind !== "directory") {
      return yield* Effect.fail(refusal("unowned-collision", [skillDirectory]));
    }
    return yield* inspectMarker(home);
  });

const planSkill = (
  workingDirectory: string,
): Effect.Effect<SkillDecision, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const observation = yield* inspectSkill(workingDirectory);
    switch (observation.tag) {
      case "absent":
        return { tag: "install", home: observation.home };
      case "unowned":
        return yield* Effect.fail(refusal("unowned-collision", [observation.skillDirectory]));
      case "malformed":
        return yield* Effect.fail(refusal("malformed-marker", [observation.markerPath]));
      case "owned": {
        const installed = yield* readSkillTree(path.join(observation.home.path, SKILL_DIRECTORY));
        if (installed.hasNonFile || digestSkillTree(installed.files) !== observation.marker.digest) {
          return { tag: "skip", home: observation.home };
        }
        return { tag: "update", home: observation.home, expectedDigest: observation.marker.digest };
      }
    }
  });

export const planSetup = (
  workingDirectory: string,
): Effect.Effect<SetupPlan, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const tracker = yield* inspectTracker(workingDirectory);
    const skill = yield* planSkill(workingDirectory);
    return { workingDirectory, tracker, skill };
  });

const writeSkill = (
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

const preflightSkill = (plan: SetupPlan): Effect.Effect<SkillDecision, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    if (plan.skill.tag === "skip") {
      return plan.skill;
    }

    const current = yield* inspectSkill(plan.workingDirectory);
    if (plan.skill.tag === "install") {
      if (current.tag === "absent") {
        return plan.skill;
      }
      const changedPath =
        current.tag === "owned"
          ? current.home.path
          : current.tag === "unowned"
            ? current.skillDirectory
            : current.markerPath;
      return yield* Effect.fail(refusal("changed-after-plan", [changedPath]));
    }

    switch (current.tag) {
      case "absent":
        return yield* Effect.fail(refusal("changed-after-plan", [path.join(current.home.path, SKILL_DIRECTORY)]));
      case "unowned":
        return yield* Effect.fail(refusal("unowned-collision", [current.skillDirectory]));
      case "malformed":
        return yield* Effect.fail(refusal("malformed-marker", [current.markerPath]));
      case "owned": {
        const installed = yield* readSkillTree(path.join(current.home.path, SKILL_DIRECTORY));
        if (
          current.marker.digest !== plan.skill.expectedDigest ||
          installed.hasNonFile ||
          digestSkillTree(installed.files) !== current.marker.digest
        ) {
          return { tag: "skip", home: current.home };
        }
        return plan.skill;
      }
    }
  });

export const applySetup = (
  plan: SetupPlan,
  skill: PackagedSkill,
): Effect.Effect<SetupOutcome, SetupError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    let skillDecision = yield* preflightSkill(plan);
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
    if (skillDecision.tag !== "skip") {
      skillDecision = yield* preflightSkill({ ...plan, skill: skillDecision });
    }
    switch (skillDecision.tag) {
      case "install":
        yield* writeSkill(skillDecision.home, skill);
        return { tag: "installed", home: skillDecision.home, trackerCreated };
      case "update": {
        const skillDirectory = path.join(skillDecision.home.path, SKILL_DIRECTORY);
        yield* fs
          .remove(skillDirectory, { recursive: true })
          .pipe(Effect.mapError((error) => writeError("remove", skillDirectory, error.message)));
        yield* writeSkill(skillDecision.home, skill);
        return { tag: "updated", home: skillDecision.home };
      }
      case "skip":
        return { tag: "skipped", home: skillDecision.home };
    }
  });
