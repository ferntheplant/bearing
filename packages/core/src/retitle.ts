import { Data, Effect, FileSystem, Path } from "effect";

import {
  deriveSlug,
  type MalformedTrackerError,
  type TrackerNotFoundError,
  type TrackerReadError,
} from "./acquisition.ts";
import { acquireValidObservation, buildIndex, resolve } from "./analysis.ts";

export class RetitleError extends Data.TaggedError("RetitleError")<{
  readonly reason: "no-match" | "ambiguous" | "backlog-item";
  readonly prefix: string;
  readonly candidates: readonly string[];
}> {}

export class RetitleApplyError extends Data.TaggedError("RetitleApplyError")<{
  readonly operation: "write-file" | "remove";
  readonly path: string;
  readonly message: string;
}> {}

export type RetitleEdit =
  | { readonly operation: "write-file"; readonly path: string; readonly source: string }
  | { readonly operation: "remove"; readonly path: string };

export interface RetitlePlan {
  readonly id: string;
  readonly slug: string;
  readonly from: string;
  readonly to: string;
  readonly edits: readonly RetitleEdit[];
}

export interface RetitleApplyResult {
  readonly id: string;
  readonly slug: string;
  readonly from: string;
  readonly to: string;
  readonly changed: boolean;
}

const refusal = (reason: RetitleError["reason"], prefix: string, candidates: readonly string[] = []): RetitleError =>
  new RetitleError({ reason, prefix, candidates });

export const planRetitle = (
  startDirectory: string,
  prefix: string,
  title: string,
): Effect.Effect<
  RetitlePlan,
  RetitleError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const observation = yield* acquireValidObservation(startDirectory);
    const resolution = resolve(buildIndex(observation), prefix);
    switch (resolution.tag) {
      case "no-match":
        return yield* Effect.fail(refusal("no-match", prefix));
      case "ambiguous":
        return yield* Effect.fail(
          refusal(
            "ambiguous",
            prefix,
            resolution.candidates.map((entry) => entry.id),
          ),
        );
      case "match": {
        if (resolution.entry.kind === "backlog") {
          return yield* Effect.fail(refusal("backlog-item", resolution.entry.id));
        }
        const entry = resolution.entry;
        const slug = deriveSlug(title);
        const destination = path.join(path.dirname(entry.path), `${entry.id}-${slug}.md`);
        return {
          id: entry.id,
          slug,
          from: entry.path,
          to: destination,
          edits:
            destination === entry.path
              ? []
              : [
                  { operation: "write-file", path: destination, source: entry.source },
                  { operation: "remove", path: entry.path },
                ],
        };
      }
    }
  });

export const applyRetitle = (
  plan: RetitlePlan,
): Effect.Effect<RetitleApplyResult, RetitleApplyError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    for (const edit of plan.edits) {
      switch (edit.operation) {
        case "write-file":
          yield* fs
            .writeFileString(edit.path, edit.source, { flag: "wx" })
            .pipe(
              Effect.mapError(
                (error) => new RetitleApplyError({ operation: "write-file", path: edit.path, message: error.message }),
              ),
            );
          break;
        case "remove":
          yield* fs
            .remove(edit.path)
            .pipe(
              Effect.mapError(
                (error) => new RetitleApplyError({ operation: "remove", path: edit.path, message: error.message }),
              ),
            );
          break;
      }
    }
    return { id: plan.id, slug: plan.slug, from: plan.from, to: plan.to, changed: plan.edits.length > 0 };
  });
