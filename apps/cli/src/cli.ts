#!/usr/bin/env bun

import { listTickets, TrackerReadError } from "@bearing/core";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { Effect } from "effect";

import { renderJson, renderText } from "./render.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const tracker = args.find((arg) => arg !== "--json");

if (tracker === undefined) {
  process.stderr.write("usage: bearing [--json] <tracker>\n");
  process.exit(1);
}

const program = Effect.gen(function* () {
  const tickets = yield* listTickets(tracker);
  return json ? renderJson(tickets) : renderText(tickets);
});

let output: string;
try {
  output = await Effect.runPromise(program.pipe(Effect.provide(BunFileSystem.layer), Effect.provide(BunPath.layer)));
} catch (error) {
  if (error instanceof TrackerReadError) {
    process.stderr.write(`error: ${error.message}\n`);
  } else {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
}
process.stdout.write(`${output}\n`);
