#!/usr/bin/env bun

import { listTickets, TrackerReadError } from "@bearing/core";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { Effect } from "effect";

import { renderJson, renderText } from "./render.ts";

interface Writer {
  write(text: string): unknown;
}

export const main = async (
  args: readonly string[],
  stdout: Writer = process.stdout,
  stderr: Writer = process.stderr,
): Promise<number> => {
  const json = args.includes("--json");
  const tracker = args.find((arg) => arg !== "--json");

  if (tracker === undefined) {
    stderr.write("usage: bearing [--json] <tracker>\n");
    return 1;
  }

  const program = Effect.gen(function* () {
    const tickets = yield* listTickets(tracker);
    return json ? renderJson(tickets) : renderText(tickets);
  });

  try {
    const output = await Effect.runPromise(
      program.pipe(Effect.provide(BunFileSystem.layer), Effect.provide(BunPath.layer)),
    );
    stdout.write(`${output}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof TrackerReadError || error instanceof Error ? error.message : String(error);
    stderr.write(`error: ${message}\n`);
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
