import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import {
  acquireTracker,
  discoverTracker,
  documentBody,
  requireValidTracker,
  type BacklogItem,
  type MalformedTrackerError,
  type Ticket,
  type TicketType,
  type TrackerNotFoundError,
  type TrackerReadError,
  type ValidTrackerObservation,
} from "./acquisition.ts";

export { MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";

export type ResolvedKind = "backlog" | "ticket";

export interface ResolvedItem {
  readonly kind: ResolvedKind;
  readonly id: string;
  readonly slug: string;
  readonly path: string;
}

export type ResolveResult =
  | { readonly tag: "match"; readonly item: ResolvedItem }
  | { readonly tag: "no-match"; readonly prefix: string }
  | { readonly tag: "ambiguous"; readonly prefix: string; readonly candidates: readonly ResolvedItem[] };

export type ShowItem =
  | {
      readonly kind: "ticket";
      readonly id: string;
      readonly slug: string;
      readonly type: TicketType;
      readonly project: string | undefined;
      readonly blockers: readonly string[];
      readonly body: string;
      readonly source: string;
    }
  | {
      readonly kind: "backlog";
      readonly id: string;
      readonly slug: string;
      readonly body: string;
      readonly source: string;
    };

export type ShowResult =
  | { readonly tag: "resolved"; readonly item: ShowItem }
  | { readonly tag: "no-match"; readonly prefix: string }
  | { readonly tag: "ambiguous"; readonly prefix: string; readonly candidates: readonly ResolvedItem[] };

interface BacklogEntry {
  readonly kind: "backlog";
  readonly id: string;
  readonly slug: string;
  readonly path: string;
  readonly source: string;
  readonly parsed: BacklogItem;
}

interface TicketEntry {
  readonly kind: "ticket";
  readonly id: string;
  readonly slug: string;
  readonly path: string;
  readonly source: string;
  readonly parsed: Ticket;
}

interface MapEntry {
  readonly kind: "map";
  readonly path: string;
  readonly source: string;
}

type IndexEntry = BacklogEntry | TicketEntry | MapEntry;
type ResolvableEntry = BacklogEntry | TicketEntry;

type InternalResolution =
  | { readonly tag: "match"; readonly entry: ResolvableEntry }
  | { readonly tag: "no-match"; readonly prefix: string }
  | { readonly tag: "ambiguous"; readonly prefix: string; readonly candidates: readonly ResolvableEntry[] };

const buildIndex = (observation: ValidTrackerObservation): readonly IndexEntry[] => [
  ...observation.backlog.map((document) => ({
    kind: "backlog" as const,
    id: document.parsed.success.id,
    slug: document.parsed.success.slug,
    path: document.path,
    source: document.source,
    parsed: document.parsed.success,
  })),
  ...observation.tickets.map((document) => ({
    kind: "ticket" as const,
    id: document.parsed.success.id,
    slug: document.parsed.success.slug,
    path: document.path,
    source: document.source,
    parsed: document.parsed.success,
  })),
  ...observation.maps.map((document) => ({
    kind: "map" as const,
    path: document.path,
    source: document.source,
  })),
];

const resolve = (index: readonly IndexEntry[], prefix: string): InternalResolution => {
  const candidates = index.filter(
    (entry): entry is ResolvableEntry => entry.kind !== "map" && entry.id.startsWith(prefix),
  );
  if (candidates.length === 0) {
    return { tag: "no-match", prefix };
  }
  if (candidates.length === 1) {
    for (const entry of candidates) {
      return { tag: "match", entry };
    }
  }
  return { tag: "ambiguous", prefix, candidates };
};

const toResolvedItem = (entry: ResolvableEntry): ResolvedItem => ({
  kind: entry.kind,
  id: entry.id,
  slug: entry.slug,
  path: entry.path,
});

const toShowItem = (entry: ResolvableEntry): ShowItem =>
  entry.kind === "backlog"
    ? {
        kind: "backlog",
        id: entry.id,
        slug: entry.slug,
        body: documentBody(entry.source),
        source: entry.source,
      }
    : {
        kind: "ticket",
        id: entry.id,
        slug: entry.slug,
        type: entry.parsed.type,
        project: entry.parsed.project,
        blockers: entry.parsed.blockers,
        body: documentBody(entry.source),
        source: entry.source,
      };

const acquireValidObservation = (
  startDirectory: string,
): Effect.Effect<
  ValidTrackerObservation,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const tracker = yield* discoverTracker(startDirectory);
    const observation = yield* acquireTracker(tracker);
    return yield* requireValidTracker(observation);
  });

export const resolveId = (
  startDirectory: string,
  prefix: string,
): Effect.Effect<
  ResolveResult,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const observation = yield* acquireValidObservation(startDirectory);
    const resolution = resolve(buildIndex(observation), prefix);
    switch (resolution.tag) {
      case "match":
        return { tag: "match", item: toResolvedItem(resolution.entry) };
      case "no-match":
        return resolution;
      case "ambiguous":
        return { tag: "ambiguous", prefix, candidates: resolution.candidates.map(toResolvedItem) };
    }
  });

export const showItem = (
  startDirectory: string,
  prefix: string,
): Effect.Effect<
  ShowResult,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const observation = yield* acquireValidObservation(startDirectory);
    const resolution = resolve(buildIndex(observation), prefix);
    switch (resolution.tag) {
      case "match":
        return { tag: "resolved", item: toShowItem(resolution.entry) };
      case "no-match":
        return resolution;
      case "ambiguous":
        return { tag: "ambiguous", prefix, candidates: resolution.candidates.map(toResolvedItem) };
    }
  });
