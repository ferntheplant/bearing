#!/usr/bin/env bun

import { listTickets } from "@bearing/core";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { Effect } from "effect";

import { renderJson, renderSetupOutcome, renderText } from "./render.ts";
import { promptDestination, runSetup, type AskDestination } from "./setup.ts";

interface Writer {
  write(text: string): unknown;
}

export const main = async (
  args: readonly string[],
  stdout: Writer = process.stdout,
  stderr: Writer = process.stderr,
  cwd: string = process.cwd(),
  ask: AskDestination = promptDestination,
): Promise<number> => {
  if (args[0] === "init") {
    if (args.length !== 1) {
      stderr.write("usage: bearing init\n");
      return 1;
    }
    try {
      const outcome = await runSetup(cwd, ask);
      stdout.write(`${renderSetupOutcome(outcome)}\n`);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`error: ${message}\n`);
      return 1;
    }
  }

  const json = args.includes("--json");

  if (args.some((arg) => arg !== "--json")) {
    stderr.write("usage: bearing [--json] | bearing init\n");
    return 1;
  }

  const program = Effect.gen(function* () {
    const tickets = yield* listTickets(cwd);
    return json ? renderJson(tickets) : renderText(tickets);
  });

  try {
    const output = await Effect.runPromise(
      program.pipe(Effect.provide(BunFileSystem.layer), Effect.provide(BunPath.layer)),
    );
    stdout.write(`${output}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`error: ${message}\n`);
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
