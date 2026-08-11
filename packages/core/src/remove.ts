import type { Path } from "effect";
import { Data, Effect, FileSystem } from "effect";

import type { BlockersSyntax, MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";
import { acquireValidObservation, buildIndex, resolve, type ResolvedItem, type ResolvableEntry } from "./analysis.ts";

export class RemovalError extends Data.TaggedError("RemovalError")<{
  readonly reason: "no-match" | "ambiguous" | "design-ticket" | "backlog-item";
  readonly prefix: string;
  readonly candidates: readonly string[];
}> {}

export class RemovalApplyError extends Data.TaggedError("RemovalApplyError")<{
  readonly operation: "remove" | "write-file";
  readonly path: string;
  readonly message: string;
}> {}

export interface RemovalRewrite {
  readonly path: string;
  readonly source: string;
}

export interface RemovalPlan {
  readonly target: ResolvedItem;
  readonly rewrites: readonly RemovalRewrite[];
}

export interface RemovalApplyResult {
  readonly id: string;
  readonly removed: string;
  readonly rewrote: readonly string[];
}

type RemovalReason = RemovalError["reason"];

const refusal = (reason: RemovalReason, prefix: string, candidates: readonly string[]): RemovalError =>
  new RemovalError({ reason, prefix, candidates });

const splice = (source: string, start: number, end: number, replacement: string): string =>
  `${source.slice(0, start)}${replacement}${source.slice(end)}`;

const ID_PATTERN = /^[0-9abcdefghjkmnpqrstvwxyz]{6}$/;

const renderBlocker = (id: string): string => (ID_PATTERN.test(id) ? id : JSON.stringify(id));

/**
 * A lossless rewrite of a ticket's frontmatter: everything except the `blockers` value —
 * body, other frontmatter keys, and their order — survives byte-for-byte. A list that
 * becomes empty has the `blockers` key removed rather than left as `[]`.
 */
const stripBlockers = (source: string, syntax: BlockersSyntax, remains: readonly string[]): string => {
  if (remains.length === 0) {
    return splice(source, syntax.fieldStart, syntax.fieldEnd, "");
  }
  const rendered = remains.map(renderBlocker);
  const replacement =
    syntax.style === "flow"
      ? `[${rendered.join(", ")}]`
      : `${rendered.map((id) => `- ${id}`).join(`${syntax.lineEnding}${" ".repeat(syntax.indent)}`)}${syntax.lineEnding}`;
  return splice(source, syntax.valueStart, syntax.valueEnd, replacement);
};

type RemovalMode = "close" | "remove";

const planRemoval = (
  startDirectory: string,
  prefix: string,
  mode: RemovalMode,
): Effect.Effect<
  RemovalPlan,
  RemovalError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const observation = yield* acquireValidObservation(startDirectory);
    const resolution = resolve(buildIndex(observation), prefix);
    switch (resolution.tag) {
      case "no-match":
        return yield* Effect.fail(refusal("no-match", prefix, []));
      case "ambiguous":
        return yield* Effect.fail(
          refusal(
            "ambiguous",
            prefix,
            resolution.candidates.map((entry) => entry.id),
          ),
        );
      case "match": {
        const entry: ResolvableEntry = resolution.entry;
        if (entry.kind === "ticket" && mode === "close" && entry.parsed.type === "design") {
          return yield* Effect.fail(refusal("design-ticket", entry.id, []));
        }
        if (entry.kind === "backlog" && mode === "close") {
          return yield* Effect.fail(refusal("backlog-item", entry.id, []));
        }
        const rewrites: RemovalRewrite[] = [];
        for (const document of observation.tickets) {
          const ticket = document.parsed.success;
          if (ticket.id === entry.id || !ticket.blockers.includes(entry.id)) {
            continue;
          }
          const blockersSyntax = document.syntax.blockers;
          if (blockersSyntax === undefined) {
            return yield* Effect.die(new Error(`parsed blockers for ${document.path} have no retained syntax`));
          }
          rewrites.push({
            path: document.path,
            source: stripBlockers(
              document.source,
              blockersSyntax,
              ticket.blockers.filter((id) => id !== entry.id),
            ),
          });
        }
        return { target: { kind: entry.kind, id: entry.id, slug: entry.slug, path: entry.path }, rewrites };
      }
    }
  });

export const planClose = (
  startDirectory: string,
  prefix: string,
): Effect.Effect<
  RemovalPlan,
  RemovalError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> => planRemoval(startDirectory, prefix, "close");

export const planRemove = (
  startDirectory: string,
  prefix: string,
): Effect.Effect<
  RemovalPlan,
  RemovalError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> => planRemoval(startDirectory, prefix, "remove");

export const applyRemoval = (
  plan: RemovalPlan,
): Effect.Effect<RemovalApplyResult, RemovalApplyError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .remove(plan.target.path)
      .pipe(
        Effect.mapError(
          (error) => new RemovalApplyError({ operation: "remove", path: plan.target.path, message: error.message }),
        ),
      );
    const rewrote: string[] = [];
    for (const rewrite of plan.rewrites) {
      yield* fs
        .writeFileString(rewrite.path, rewrite.source)
        .pipe(
          Effect.mapError(
            (error) => new RemovalApplyError({ operation: "write-file", path: rewrite.path, message: error.message }),
          ),
        );
      rewrote.push(rewrite.path);
    }
    return { id: plan.target.id, removed: plan.target.path, rewrote };
  });
