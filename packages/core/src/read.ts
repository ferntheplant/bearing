import type { FileSystem, Path } from "effect";
import { Effect } from "effect";

import {
  acquireTracker,
  type BacklogItem,
  discoverTracker,
  type MalformedTrackerError,
  type MapEntry,
  requireValidTracker,
  type Ticket,
  type TrackerNotFoundError,
  type TrackerReadError,
  type ValidTrackerObservation,
} from "./acquisition.ts";

export { MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";

export type { BacklogItem, MapEntry, Ticket, TicketType } from "./acquisition.ts";

const acquireValid = (
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

export const listTickets = (
  startDirectory: string,
): Effect.Effect<
  readonly Ticket[],
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const valid = yield* acquireValid(startDirectory);
    return valid.tickets.map((ticket) => ticket.parsed.success);
  });

export const listBacklog = (
  startDirectory: string,
): Effect.Effect<
  readonly BacklogItem[],
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const valid = yield* acquireValid(startDirectory);
    return valid.backlog.map((item) => item.parsed.success);
  });

export interface FogReport {
  readonly project: string;
  readonly patches: readonly MapEntry[];
}

export type FogResult =
  | { readonly tag: "fog"; readonly maps: readonly FogReport[] }
  | { readonly tag: "no-project"; readonly project: string; readonly projects: readonly string[] };

export const listFog = (
  startDirectory: string,
  project?: string,
): Effect.Effect<
  FogResult,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const valid = yield* acquireValid(startDirectory);
    const reports = valid.maps.map((document) => {
      const parsed = document.parsed.success;
      return { project: parsed.project, patches: parsed.patches };
    });
    if (project === undefined) {
      return { tag: "fog", maps: reports };
    }
    const report = reports.find((candidate) => candidate.project === project);
    if (report === undefined) {
      return { tag: "no-project", project, projects: reports.map((candidate) => candidate.project) };
    }
    return { tag: "fog", maps: [report] };
  });
