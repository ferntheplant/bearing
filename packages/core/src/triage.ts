import { Data, Effect, FileSystem, Path } from "effect";
import { stringify as stringifyYaml } from "yaml";

import type { MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";
import { acquireValidObservation, buildIndex, resolve } from "./analysis.ts";

export type TriageVerdict =
  | { readonly kind: "ticket" }
  | { readonly kind: "project"; readonly project: string }
  | { readonly kind: "drop" };

export class TriageError extends Data.TaggedError("TriageError")<{
  readonly reason: "no-match" | "ambiguous" | "ticket-item" | "project-missing";
  readonly prefix: string;
  readonly candidates: readonly string[];
  readonly project?: string;
  readonly projects?: readonly string[];
}> {}

export class TriageApplyError extends Data.TaggedError("TriageApplyError")<{
  readonly operation: "write-file" | "remove";
  readonly path: string;
  readonly message: string;
}> {}

export type TriagePlan =
  | {
      readonly kind: "drop";
      readonly id: string;
      readonly slug: string;
      readonly from: string;
    }
  | {
      readonly kind: "promote";
      readonly id: string;
      readonly slug: string;
      readonly from: string;
      readonly to: string;
      readonly source: string;
      readonly project: string | undefined;
    };

export type TriageApplyResult =
  | {
      readonly id: string;
      readonly slug: string;
      readonly verdict: "drop";
      readonly from: string;
    }
  | {
      readonly id: string;
      readonly slug: string;
      readonly verdict: "ticket" | "project";
      readonly from: string;
      readonly to: string;
      readonly project?: string;
    };

const refusal = (
  reason: TriageError["reason"],
  prefix: string,
  candidates: readonly string[],
  extra: { readonly project?: string; readonly projects?: readonly string[] } = {},
): TriageError =>
  new TriageError({
    reason,
    prefix,
    candidates,
    ...(extra.project === undefined ? {} : { project: extra.project }),
    ...(extra.projects === undefined ? {} : { projects: extra.projects }),
  });

/**
 * Promotion is ordered like a retitle: the ticket is written before the backlog
 * item is unlinked, so an interrupted triage leaves a duplicate id rather than
 * a disappearing item (ADR 0025).
 */
export const planTriage = (
  startDirectory: string,
  prefix: string,
  verdict: TriageVerdict,
): Effect.Effect<
  TriagePlan,
  TriageError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
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
        if (entry.kind === "ticket") {
          return yield* Effect.fail(refusal("ticket-item", entry.id, []));
        }
        if (verdict.kind === "drop") {
          return { kind: "drop", id: entry.id, slug: entry.slug, from: entry.path };
        }
        const projects = observation.maps.map((document) => document.parsed.success.project);
        const project = verdict.kind === "project" ? verdict.project : undefined;
        if (verdict.kind === "project" && !projects.includes(verdict.project)) {
          return yield* Effect.fail(refusal("project-missing", prefix, [], { project: verdict.project, projects }));
        }
        const frontmatter = stringifyYaml(project === undefined ? { type: "build" } : { type: "build", project });
        return {
          kind: "promote",
          id: entry.id,
          slug: entry.slug,
          from: entry.path,
          to: path.join(observation.root, "tickets", `${entry.id}-${entry.slug}.md`),
          project,
          source: `---\n${frontmatter}---\n\n${entry.source}`,
        };
      }
    }
  });

export const applyTriage = (
  plan: TriagePlan,
): Effect.Effect<TriageApplyResult, TriageApplyError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if (plan.kind === "drop") {
      yield* fs
        .remove(plan.from)
        .pipe(
          Effect.mapError(
            (error) => new TriageApplyError({ operation: "remove", path: plan.from, message: error.message }),
          ),
        );
      return { id: plan.id, slug: plan.slug, verdict: "drop", from: plan.from };
    }
    yield* fs
      .writeFileString(plan.to, plan.source, { flag: "wx" })
      .pipe(
        Effect.mapError(
          (error) => new TriageApplyError({ operation: "write-file", path: plan.to, message: error.message }),
        ),
      );
    yield* fs
      .remove(plan.from)
      .pipe(
        Effect.mapError(
          (error) => new TriageApplyError({ operation: "remove", path: plan.from, message: error.message }),
        ),
      );
    return {
      id: plan.id,
      slug: plan.slug,
      verdict: plan.project === undefined ? "ticket" : "project",
      from: plan.from,
      to: plan.to,
      ...(plan.project === undefined ? {} : { project: plan.project }),
    };
  });
