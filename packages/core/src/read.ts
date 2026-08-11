import type { FileSystem, Path } from "effect";
import { Effect } from "effect";

import {
  acquireTracker,
  type BacklogItem,
  discoverTracker,
  type MalformedTrackerError,
  requireValidTracker,
  type Ticket,
  type TrackerNotFoundError,
  type TrackerReadError,
  type ValidTrackerObservation,
} from "./acquisition.ts";

export { MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";

export type { BacklogItem, Ticket, TicketType } from "./acquisition.ts";

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
