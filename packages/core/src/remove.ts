import type { Path } from "effect";
import { Data, Effect, FileSystem } from "effect";

import type {
  BlockersSyntax,
  MalformedTrackerError,
  TrackerNotFoundError,
  TrackerReadError,
  TrailRow,
} from "./acquisition.ts";
import { acquireValidObservation, buildIndex, resolve, type ResolvedItem, type ResolvableEntry } from "./analysis.ts";

export class RemovalError extends Data.TaggedError("RemovalError")<{
  readonly reason:
    | "no-match"
    | "ambiguous"
    | "backlog-item"
    | "design-no-project"
    | "project-missing"
    | "trail-row-missing"
    | "trail-outcome-empty";
  readonly prefix: string;
  readonly candidates: readonly string[];
  readonly project?: string;
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

export type ClosePlan = BuildClosePlan | DesignClosePlan;

export interface BuildClosePlan extends RemovalPlan {
  readonly kind: "build";
}

export interface DesignClosePlan extends RemovalPlan {
  readonly kind: "design";
  readonly ticket: {
    readonly id: string;
    readonly slug: string;
    readonly project: string;
    readonly path: string;
    readonly source: string;
  };
  readonly trail: {
    readonly path: string;
    readonly row: TrailRow;
  };
  readonly unblocks: readonly ResolvedItem[];
}

export interface RemovalApplyResult {
  readonly id: string;
  readonly removed: string;
  readonly rewrote: readonly string[];
}

type RemovalReason = RemovalError["reason"];

const refusal = (
  reason: RemovalReason,
  prefix: string,
  candidates: readonly string[],
  project?: string,
): RemovalError => new RemovalError({ reason, prefix, candidates, ...(project === undefined ? {} : { project }) });

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

const planResolvedRemoval = (
  observation: Parameters<typeof buildIndex>[0],
  entry: ResolvableEntry,
): Effect.Effect<RemovalPlan> =>
  Effect.gen(function* () {
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
  });

export const planRemove = (
  startDirectory: string,
  prefix: string,
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
        return yield* planResolvedRemoval(observation, entry);
      }
    }
  });

const planDesignClose = (
  observation: Parameters<typeof buildIndex>[0],
  entry: Extract<ResolvableEntry, { readonly kind: "ticket" }>,
  removal: RemovalPlan,
): Effect.Effect<DesignClosePlan, RemovalError> =>
  Effect.gen(function* () {
    const project = entry.parsed.project;
    if (project === undefined) {
      return yield* Effect.fail(refusal("design-no-project", entry.id, []));
    }
    const map = observation.maps.find((document) => document.parsed.success.project === project);
    if (map === undefined) {
      return yield* Effect.fail(refusal("project-missing", entry.id, [], project));
    }
    const row = map.parsed.success.trail.find((candidate) => candidate.id === entry.id);
    if (row === undefined) {
      return yield* Effect.fail(refusal("trail-row-missing", entry.id, [], project));
    }
    if (row.outcome.trim().length === 0) {
      return yield* Effect.fail(refusal("trail-outcome-empty", entry.id, [], project));
    }
    const unblocks = observation.tickets
      .filter(
        (document) =>
          document.parsed.success.blockers.length === 1 && document.parsed.success.blockers.includes(entry.id),
      )
      .map((document) => ({
        kind: "ticket" as const,
        id: document.parsed.success.id,
        slug: document.parsed.success.slug,
        path: document.path,
      }));
    return {
      kind: "design",
      ...removal,
      ticket: {
        id: entry.id,
        slug: entry.slug,
        project,
        path: entry.path,
        source: entry.source,
      },
      trail: { path: map.path, row },
      unblocks,
    };
  });

export const planClose = (
  startDirectory: string,
  prefix: string,
): Effect.Effect<
  ClosePlan,
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
        const entry = resolution.entry;
        if (entry.kind === "backlog") {
          return yield* Effect.fail(refusal("backlog-item", entry.id, []));
        }
        const removal = yield* planResolvedRemoval(observation, entry);
        return entry.parsed.type === "design"
          ? yield* planDesignClose(observation, entry, removal)
          : { kind: "build", ...removal };
      }
    }
  });

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
