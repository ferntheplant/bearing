import { Data, Effect, FileSystem, Path, Result } from "effect";

import { parseTicketFile } from "./ticket.ts";
import type { Ticket } from "./ticket.ts";

export class TrackerReadError extends Data.TaggedError("TrackerReadError")<{
  readonly message: string;
}> {}

export const listTickets = (
  tracker: string,
): Effect.Effect<readonly Ticket[], TrackerReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const ticketsDir = path.join(tracker, "tickets");
    const names = yield* fs
      .readDirectory(ticketsDir)
      .pipe(
        Effect.mapError((error) => new TrackerReadError({ message: `cannot read ${ticketsDir}: ${error.message}` })),
      );
    const readTicket = (name: string) =>
      Effect.gen(function* () {
        const fullPath = path.join(ticketsDir, name);
        const content = yield* fs
          .readFileString(fullPath)
          .pipe(
            Effect.mapError((error) => new TrackerReadError({ message: `cannot read ${fullPath}: ${error.message}` })),
          );
        const parsed = parseTicketFile(name, content);
        if (Result.isFailure(parsed)) {
          return yield* Effect.fail(
            new TrackerReadError({ message: `cannot parse ${fullPath}: ${parsed.failure.message}` }),
          );
        }
        return parsed.success;
      });
    return yield* Effect.forEach(names.filter((name) => name.endsWith(".md")).sort(), readTicket, { concurrency: 1 });
  });
