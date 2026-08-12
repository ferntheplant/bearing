import { Data, Effect, FileSystem, Path } from "effect";

import {
  acquireTracker,
  discoverTracker,
  mintItemIdentity,
  requireValidTracker,
  type MalformedTrackerError,
  type TicketType,
  type TrackerNotFoundError,
  type TrackerReadError,
} from "./acquisition.ts";

export class CreationWriteError extends Data.TaggedError("CreationWriteError")<{
  readonly operation: "write-file";
  readonly path: string;
  readonly message: string;
}> {}

export class TicketCreationError extends Data.TaggedError("TicketCreationError")<{
  readonly reason: "design-no-project" | "project-missing";
  readonly project?: string;
  readonly projects: readonly string[];
}> {}

export interface CreationPlan {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly source: string;
  readonly path: string;
}

export interface CreationApplyResult {
  readonly id: string;
  readonly slug: string;
  readonly path: string;
}

const acquireCreationContext = (startDirectory: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const tracker = yield* discoverTracker(startDirectory);
    const observation = yield* acquireTracker(tracker);
    const valid = yield* requireValidTracker(observation);
    return { path, tracker, valid };
  });

export const planCapture = (
  startDirectory: string,
  title: string,
): Effect.Effect<
  CreationPlan,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { path, tracker, valid } = yield* acquireCreationContext(startDirectory);
    const { id, slug } = yield* mintItemIdentity(valid, title);
    return {
      id,
      slug,
      title,
      source: `# ${title}\n`,
      path: path.join(tracker, "backlog", `${id}-${slug}.md`),
    };
  });

export const planTicketCreation = (
  startDirectory: string,
  type: TicketType,
  title: string,
  project?: string,
): Effect.Effect<
  CreationPlan,
  TicketCreationError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { path, tracker, valid } = yield* acquireCreationContext(startDirectory);
    const projects = valid.maps.map((document) => document.parsed.success.project);
    if (type === "design" && project === undefined) {
      return yield* Effect.fail(new TicketCreationError({ reason: "design-no-project", projects }));
    }
    if (project !== undefined && !projects.includes(project)) {
      return yield* Effect.fail(new TicketCreationError({ reason: "project-missing", project, projects }));
    }
    const { id, slug } = yield* mintItemIdentity(valid, title);
    return {
      id,
      slug,
      title,
      source: `---\ntype: ${type}\n${project === undefined ? "" : `project: ${project}\n`}---\n\n# ${title}\n`,
      path: path.join(tracker, "tickets", `${id}-${slug}.md`),
    };
  });

export const applyCreation = (
  plan: CreationPlan,
): Effect.Effect<CreationApplyResult, CreationWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .writeFileString(plan.path, plan.source, { flag: "wx" })
      .pipe(
        Effect.mapError(
          (error) => new CreationWriteError({ operation: "write-file", path: plan.path, message: error.message }),
        ),
      );
    return { id: plan.id, slug: plan.slug, path: plan.path };
  });
