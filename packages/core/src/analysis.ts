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

export type IndexEntry = BacklogEntry | TicketEntry | MapEntry;
export type ResolvableEntry = BacklogEntry | TicketEntry;

export type InternalResolution =
  | { readonly tag: "match"; readonly entry: ResolvableEntry }
  | { readonly tag: "no-match"; readonly prefix: string }
  | { readonly tag: "ambiguous"; readonly prefix: string; readonly candidates: readonly ResolvableEntry[] };

export const buildIndex = (observation: ValidTrackerObservation): readonly IndexEntry[] => [
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

export const resolve = (index: readonly IndexEntry[], prefix: string): InternalResolution => {
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

export { acquireValidObservation };

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

export interface ListedTicket {
  readonly id: string;
  readonly slug: string;
  readonly type: TicketType;
  readonly project: string | undefined;
  readonly blockers: readonly string[];
  readonly ready: boolean;
  readonly blockedBy: readonly string[];
  readonly unblocks: readonly string[];
}

export interface TicketSelector {
  readonly types?: readonly TicketType[];
  readonly readiness?: readonly ("ready" | "blocked")[];
  readonly project?: string;
}

export type ListTicketsResult =
  | { readonly tag: "ok"; readonly tickets: readonly ListedTicket[] }
  | { readonly tag: "cycle"; readonly ids: readonly string[] }
  | { readonly tag: "no-project"; readonly project: string; readonly projects: readonly string[] };

type BlockingGraph =
  | {
      readonly tag: "ok";
      readonly ready: ReadonlyMap<string, boolean>;
      readonly blockedBy: ReadonlyMap<string, readonly string[]>;
      readonly unblocks: ReadonlyMap<string, readonly string[]>;
    }
  | { readonly tag: "cycle"; readonly ids: readonly string[] };

const closureFrom = (start: string, adjacency: ReadonlyMap<string, readonly string[]>): readonly string[] => {
  const seen = new Set<string>();
  const pending: string[] = [...(adjacency.get(start) ?? [])];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    if (current === start || seen.has(current)) {
      continue;
    }
    seen.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return [...seen];
};

const WHITE = 0;
const GREY = 1;
const BLACK = 2;

const findCycle = (direct: ReadonlyMap<string, readonly string[]>): readonly string[] | undefined => {
  const colors = new Map<string, number>([...direct.keys()].map((id) => [id, WHITE]));
  for (const start of direct.keys()) {
    if (colors.get(start) !== WHITE) {
      continue;
    }

    const stack: { id: string; nextIndex: number }[] = [{ id: start, nextIndex: 0 }];
    colors.set(start, GREY);
    while (stack.length > 0) {
      const frame = stack.at(-1) as { id: string; nextIndex: number };
      const adjacent = direct.get(frame.id) ?? [];
      if (frame.nextIndex >= adjacent.length) {
        stack.pop();
        colors.set(frame.id, BLACK);
        continue;
      }

      const next = adjacent[frame.nextIndex] as string;
      frame.nextIndex += 1;
      const color = colors.get(next) ?? WHITE;
      if (color === GREY) {
        const cycleStart = stack.findIndex((entry) => entry.id === next);
        return stack.slice(cycleStart).map((entry) => entry.id);
      }
      if (color === WHITE) {
        colors.set(next, GREY);
        stack.push({ id: next, nextIndex: 0 });
      }
    }
  }
  return undefined;
};

export const deriveBlocking = (tickets: readonly Ticket[]): BlockingGraph => {
  const ids = new Set(tickets.map((ticket) => ticket.id));
  const direct = new Map<string, readonly string[]>();
  const reversed = new Map<string, string[]>();
  for (const ticket of tickets) {
    const existing = ticket.blockers.filter((blocker) => ids.has(blocker));
    direct.set(ticket.id, existing);
    for (const blocker of existing) {
      const blocked = reversed.get(blocker);
      if (blocked === undefined) {
        reversed.set(blocker, [ticket.id]);
      } else {
        blocked.push(ticket.id);
      }
    }
  }

  const cycle = findCycle(direct);
  if (cycle !== undefined) {
    return { tag: "cycle", ids: cycle };
  }

  const ready = new Map<string, boolean>();
  const blockedBy = new Map<string, readonly string[]>();
  const unblocks = new Map<string, readonly string[]>();
  for (const ticket of tickets) {
    ready.set(ticket.id, (direct.get(ticket.id) ?? []).length === 0);
    blockedBy.set(ticket.id, closureFrom(ticket.id, direct));
    unblocks.set(ticket.id, closureFrom(ticket.id, reversed));
  }
  return { tag: "ok", ready, blockedBy, unblocks };
};

const matches = (ticket: ListedTicket, selector: TicketSelector): boolean => {
  if (selector.types !== undefined) {
    if (selector.types.length === 0 || !selector.types.every((type) => type === ticket.type)) {
      return false;
    }
  }
  if (selector.readiness !== undefined) {
    if (
      selector.readiness.length === 0 ||
      !selector.readiness.every((value) => value === (ticket.ready ? "ready" : "blocked"))
    ) {
      return false;
    }
  }
  if (selector.project !== undefined && ticket.project !== selector.project) {
    return false;
  }
  return true;
};

export const listTickets = (
  startDirectory: string,
  selector: TicketSelector = {},
): Effect.Effect<
  ListTicketsResult,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const valid = yield* acquireValidObservation(startDirectory);
    const projects = valid.maps.map((document) => document.parsed.success.project);
    if (selector.project !== undefined && !projects.includes(selector.project)) {
      return { tag: "no-project", project: selector.project, projects };
    }
    const tickets = valid.tickets.map((document) => document.parsed.success);
    const graph = deriveBlocking(tickets);
    if (graph.tag === "cycle") {
      return { tag: "cycle", ids: graph.ids };
    }
    const listed = tickets.map((ticket) => ({
      id: ticket.id,
      slug: ticket.slug,
      type: ticket.type,
      project: ticket.project,
      blockers: ticket.blockers,
      ready: graph.ready.get(ticket.id) ?? false,
      blockedBy: graph.blockedBy.get(ticket.id) ?? [],
      unblocks: graph.unblocks.get(ticket.id) ?? [],
    }));
    return { tag: "ok", tickets: listed.filter((ticket) => matches(ticket, selector)) };
  });
