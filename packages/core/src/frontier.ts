import type { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";
import { acquireValidObservation, deriveBlocking } from "./analysis.ts";

export interface FrontierTicket {
  readonly id: string;
  readonly slug: string;
  readonly project: string | undefined;
  readonly gateCount: number;
}

export interface FrontierDecideGroup {
  readonly project: string;
  readonly destination: string;
  readonly fogCount: number;
  readonly tickets: readonly FrontierTicket[];
}

export interface Frontier {
  readonly build: readonly FrontierTicket[];
  readonly decide: readonly FrontierDecideGroup[];
  readonly triageCount: number;
  readonly fogbound: readonly string[];
}

export type FrontierResult =
  | { readonly tag: "ok"; readonly frontier: Frontier }
  | { readonly tag: "cycle"; readonly ids: readonly string[] };

const byGateCountThenId = (a: FrontierTicket, b: FrontierTicket): number =>
  b.gateCount - a.gateCount || a.id.localeCompare(b.id);

const singleLine = (text: string): string => text.replace(/\s+/g, " ").trim();

export const deriveFrontier = (
  startDirectory: string,
): Effect.Effect<
  FrontierResult,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const valid = yield* acquireValidObservation(startDirectory);
    const tickets = valid.tickets.map((document) => document.parsed.success);
    const graph = deriveBlocking(tickets);
    if (graph.tag === "cycle") {
      return { tag: "cycle", ids: graph.ids };
    }
    const isReady = (id: string): boolean => graph.ready.get(id) ?? false;
    const gateCount = (id: string): number => graph.unblocks.get(id)?.length ?? 0;

    const build = tickets
      .filter((ticket) => ticket.type === "build" && isReady(ticket.id))
      .map((ticket) => ({
        id: ticket.id,
        slug: ticket.slug,
        project: ticket.project,
        gateCount: gateCount(ticket.id),
      }))
      .sort(byGateCountThenId);

    const decide: FrontierDecideGroup[] = [];
    const fogbound: string[] = [];
    for (const document of valid.maps) {
      const map = document.parsed.success;
      const design = tickets.filter((ticket) => ticket.type === "design" && ticket.project === map.project);
      if (design.length === 0) {
        if (map.patches.length > 0) {
          fogbound.push(map.project);
        }
        continue;
      }
      decide.push({
        project: map.project,
        destination: singleLine(map.destination.text),
        fogCount: map.patches.length,
        tickets: design
          .filter((ticket) => isReady(ticket.id))
          .map((ticket) => ({
            id: ticket.id,
            slug: ticket.slug,
            project: ticket.project,
            gateCount: gateCount(ticket.id),
          }))
          .sort(byGateCountThenId),
      });
    }

    return {
      tag: "ok",
      frontier: {
        build,
        decide,
        triageCount: valid.backlog.length,
        fogbound,
      },
    };
  });
