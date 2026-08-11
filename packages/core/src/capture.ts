import { Data, Effect, FileSystem, Path } from "effect";

import {
  acquireTracker,
  discoverTracker,
  mintItemIdentity,
  requireValidTracker,
  type MalformedTrackerError,
  type TrackerNotFoundError,
  type TrackerReadError,
} from "./acquisition.ts";

export class CaptureWriteError extends Data.TaggedError("CaptureWriteError")<{
  readonly operation: "write-file";
  readonly path: string;
  readonly message: string;
}> {}

export interface CapturePlan {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly source: string;
  readonly path: string;
}

export interface CaptureApplyResult {
  readonly id: string;
  readonly slug: string;
  readonly path: string;
}

export const planCapture = (
  startDirectory: string,
  title: string,
): Effect.Effect<
  CapturePlan,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const tracker = yield* discoverTracker(startDirectory);
    const observation = yield* acquireTracker(tracker);
    const valid = yield* requireValidTracker(observation);
    const { id, slug } = yield* mintItemIdentity(valid, title);
    return {
      id,
      slug,
      title,
      source: `# ${title}\n`,
      path: path.join(tracker, "backlog", `${id}-${slug}.md`),
    };
  });

export const applyCapture = (
  plan: CapturePlan,
): Effect.Effect<CaptureApplyResult, CaptureWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .writeFileString(plan.path, plan.source, { flag: "wx" })
      .pipe(
        Effect.mapError(
          (error) => new CaptureWriteError({ operation: "write-file", path: plan.path, message: error.message }),
        ),
      );
    return { id: plan.id, slug: plan.slug, path: plan.path };
  });
