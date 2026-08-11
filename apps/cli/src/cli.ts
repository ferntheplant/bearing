#!/usr/bin/env bun

import { listTickets } from "@bearing/core";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { Cause, Console, Effect, Exit, Layer, Sink, Stdio, Stream, Terminal } from "effect";
import { CliConfig, CliError, CliOutput, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";

import { renderJson, renderSetupOutcome, renderText } from "./render.ts";
import { runSetup, type SetupRunner } from "./setup.ts";
import { BEARING_VERSION } from "./version.ts";

interface Writer {
  write(text: string): unknown;
}

const makeConsole = (stdout: Writer, stderr: Writer): Console.Console => {
  const toStdout = (...args: ReadonlyArray<unknown>) => {
    stdout.write(args.map(String).join(" "));
  };
  const toStderr = (...args: ReadonlyArray<unknown>) => {
    stderr.write(args.map(String).join(" "));
  };
  const noop = () => {};
  return {
    assert: noop,
    clear: noop,
    count: noop,
    countReset: noop,
    debug: toStdout,
    dir: noop,
    dirxml: noop,
    error: toStderr,
    group: noop,
    groupCollapsed: noop,
    groupEnd: noop,
    info: toStdout,
    log: toStdout,
    table: noop,
    time: noop,
    timeEnd: noop,
    timeLog: noop,
    trace: toStdout,
    warn: toStderr,
  };
};

const die = (what: string): Effect.Effect<never, never, never> =>
  Effect.die(new Error(`${what}; this is a service bearing must never use (ADR 0018, ADR 0022)`));

const dieTerminal = Terminal.make({
  columns: die("bearing never reads a terminal"),
  rows: die("bearing never reads a terminal"),
  readInput: die("bearing never reads a terminal"),
  readLine: die("bearing never reads a terminal"),
  display: () => die("bearing never writes to a terminal"),
});

const dieStdio = Stdio.make({
  args: die("bearing never reads process arguments through Stdio"),
  stdout: () => Sink.die("bearing never writes through Stdio"),
  stderr: () => Sink.die("bearing never writes through Stdio"),
  stdin: Stream.die("bearing never reads standard input"),
});

const dieSpawner = ChildProcessSpawner.make(() => die("bearing never spawns a subprocess"));

const buildLayer = (stdout: Writer, stderr: Writer) =>
  Layer.mergeAll(
    BunFileSystem.layer,
    BunPath.layer,
    Layer.succeed(Console.Console, makeConsole(stdout, stderr)),
    CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
    CliConfig.layer({ builtIns: [GlobalFlag.Help, GlobalFlag.Version] }),
    Layer.succeed(Terminal.Terminal, dieTerminal),
    Layer.succeed(Stdio.Stdio, dieStdio),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, dieSpawner),
  );

const buildCommand = (cwd: string, setup: SetupRunner, stdout: Writer) => {
  const init = Command.make("init", {}, () =>
    Effect.gen(function* () {
      const outcome = yield* Effect.tryPromise({
        try: () => setup(cwd),
        catch: (error) => error,
      });
      yield* Effect.sync(() => stdout.write(`${renderSetupOutcome(outcome)}\n`));
    }),
  ).pipe(Command.withDescription("Create a tracker and install the bearing wayfinder skill"));

  return Command.make("bearing", { json: Flag.boolean("json") }, (config) =>
    Effect.gen(function* () {
      const tickets = yield* listTickets(cwd);
      const rendered = config.json ? renderJson(tickets) : renderText(tickets);
      yield* Effect.sync(() => stdout.write(`${rendered}\n`));
    }),
  ).pipe(Command.withSubcommands([init]), Command.withDescription("List the tracker's tickets"));
};

const exitStatus = (exit: Exit.Exit<void, unknown>, stderr: Writer): number => {
  if (Exit.isSuccess(exit)) return 0;
  const error = Cause.squash(exit.cause);
  if (CliError.isCliError(error)) {
    // A pure help request exits 0; every parse error exits 1. The framework
    // already rendered help and errors through the Console service.
    return error._tag === "ShowHelp" && error.errors.length === 0 ? 0 : 1;
  }
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`error: ${message}\n`);
  return 1;
};

export const runCommand = async <Name extends string, Input, E, ContextInput>(
  command: Command.Command<Name, Input, ContextInput, E, Command.Environment>,
  args: readonly string[],
  stdout: Writer,
  stderr: Writer,
): Promise<number> => {
  const program = Command.runWith(command, { version: BEARING_VERSION })(args);
  const exit = await Effect.runPromise(program.pipe(Effect.provide(buildLayer(stdout, stderr)), Effect.exit));
  return exitStatus(exit, stderr);
};

export const main = async (
  args: readonly string[],
  stdout: Writer = process.stdout,
  stderr: Writer = process.stderr,
  cwd: string = process.cwd(),
  setup: SetupRunner = runSetup,
): Promise<number> => {
  const command = buildCommand(cwd, setup, stdout);
  return runCommand(command, args, stdout, stderr);
};

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
