import type { FileSystem, Path } from "effect";
import { Effect } from "effect";

import {
  acquireTracker,
  discoverTracker,
  type MalformedTrackerError,
  requireValidTracker,
  type Ticket,
  type TrackerNotFoundError,
  type TrackerReadError,
} from "./acquisition.ts";

export { MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";

export type { Ticket, TicketType } from "./acquisition.ts";

export const listTickets = (
  startDirectory: string,
): Effect.Effect<
  readonly Ticket[],
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const tracker = yield* discoverTracker(startDirectory);
    const observation = yield* acquireTracker(tracker);
    const valid = yield* requireValidTracker(observation);
    return valid.tickets.map((ticket) => ticket.parsed.success);
  });
