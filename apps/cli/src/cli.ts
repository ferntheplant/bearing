#!/usr/bin/env bun

import {
  applyCapture,
  listBacklog,
  listFog,
  listTickets,
  planCapture,
  showItem,
  type TicketSelector,
  type TicketType,
} from "@bearing/core";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { Cause, Console, Effect, Exit, Layer, Option, Sink, Stdio, Stream, Terminal } from "effect";
import { Argument, CliConfig, CliError, CliOutput, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";

import {
  renderBacklogList,
  renderCapture,
  renderFog,
  renderJson,
  renderList,
  renderSetupOutcome,
  renderShow,
} from "./render.ts";
import { runSetup, type SetupRunner } from "./setup.ts";
import { BEARING_VERSION } from "./version.ts";

interface Writer {
  write(text: string): unknown;
}

export interface OutputWriters {
  readonly stdout: Writer;
  readonly stderr: Writer;
}

const makeConsole = ({ stdout, stderr }: OutputWriters): Console.Console => {
  const toStdout = (...args: ReadonlyArray<unknown>) => {
    stdout.write(args.map(String).join(" "));
  };
  const toStderr = (...args: ReadonlyArray<unknown>) => {
    stderr.write(args.map(String).join(" "));
  };
  const unsupportedConsoleMethod = (method: keyof Console.Console) => () => {
    throw new Error(`bearing's CLI console does not support Console.${method}`);
  };
  return {
    assert: unsupportedConsoleMethod("assert"),
    clear: unsupportedConsoleMethod("clear"),
    count: unsupportedConsoleMethod("count"),
    countReset: unsupportedConsoleMethod("countReset"),
    debug: toStdout,
    dir: unsupportedConsoleMethod("dir"),
    dirxml: unsupportedConsoleMethod("dirxml"),
    error: toStderr,
    group: unsupportedConsoleMethod("group"),
    groupCollapsed: unsupportedConsoleMethod("groupCollapsed"),
    groupEnd: unsupportedConsoleMethod("groupEnd"),
    info: toStdout,
    log: toStdout,
    table: unsupportedConsoleMethod("table"),
    time: unsupportedConsoleMethod("time"),
    timeEnd: unsupportedConsoleMethod("timeEnd"),
    timeLog: unsupportedConsoleMethod("timeLog"),
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

const buildLayer = (output: OutputWriters) =>
  Layer.mergeAll(
    BunFileSystem.layer,
    BunPath.layer,
    Layer.succeed(Console.Console, makeConsole(output)),
    CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
    CliConfig.layer({ builtIns: [GlobalFlag.Help] }),
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

  const show = Command.make(
    "show",
    { id: Argument.string("id"), full: Flag.boolean("full"), json: Flag.boolean("json") },
    (config) =>
      Effect.gen(function* () {
        if (config.full && config.json) {
          return yield* Effect.fail(new Error("--full and --json cannot be used together"));
        }
        const result = yield* showItem(cwd, config.id);
        switch (result.tag) {
          case "resolved": {
            const rendered = config.json
              ? renderJson(result.item)
              : config.full
                ? result.item.source
                : renderShow(result.item);
            yield* Effect.sync(() => stdout.write(rendered.endsWith("\n") ? rendered : `${rendered}\n`));
            return;
          }
          case "no-match":
            return yield* Effect.fail(new Error(`no item matches id prefix "${config.id}"`));
          case "ambiguous":
            return yield* Effect.fail(
              new Error(
                `ambiguous id prefix "${config.id}": ${result.candidates.map((candidate) => candidate.id).join(", ")}`,
              ),
            );
        }
      }),
  ).pipe(Command.withDescription("Show a ticket or backlog item by id or id prefix"));

  const backlog = Command.make(
    "backlog",
    { title: Argument.optional(Argument.string("title")), json: Flag.boolean("json") },
    (config) =>
      Effect.gen(function* () {
        const title = Option.getOrUndefined(config.title);
        if (title === undefined) {
          const items = yield* listBacklog(cwd);
          const rendered = config.json ? renderJson(items) : renderBacklogList(items);
          yield* Effect.sync(() => stdout.write(`${rendered}\n`));
          return;
        }
        const plan = yield* planCapture(cwd, title);
        const result = yield* applyCapture(plan);
        const rendered = config.json ? renderJson(result) : renderCapture(result);
        yield* Effect.sync(() => stdout.write(`${rendered}\n`));
      }),
  ).pipe(Command.withDescription("Capture a backlog item, or list the backlog when called bare"));

  const fog = Command.make(
    "fog",
    { project: Argument.optional(Argument.string("project")), json: Flag.boolean("json") },
    (config) =>
      Effect.gen(function* () {
        const project = Option.getOrUndefined(config.project);
        const result = yield* listFog(cwd, project);
        switch (result.tag) {
          case "fog": {
            const rendered = config.json ? renderJson(result.maps) : renderFog(result.maps);
            yield* Effect.sync(() => stdout.write(`${rendered}\n`));
            return;
          }
          case "no-project":
            return yield* Effect.fail(
              new Error(`no map for project "${result.project}"; maps: ${result.projects.join(", ") || "none"}`),
            );
        }
      }),
  ).pipe(Command.withDescription("List the fog patches on one map, or across every map"));

  const ls = Command.make(
    "ls",
    {
      build: Flag.boolean("build"),
      design: Flag.boolean("design"),
      ready: Flag.boolean("ready"),
      blocked: Flag.boolean("blocked"),
      project: Flag.optional(Flag.string("project")),
      json: Flag.boolean("json"),
    },
    (config) =>
      Effect.gen(function* () {
        const types: TicketType[] = [];
        if (config.build) {
          types.push("build");
        }
        if (config.design) {
          types.push("design");
        }
        const readiness: ("ready" | "blocked")[] = [];
        if (config.ready) {
          readiness.push("ready");
        }
        if (config.blocked) {
          readiness.push("blocked");
        }
        const project = Option.getOrUndefined(config.project);
        const selector: TicketSelector = {
          ...(types.length > 0 ? { types } : {}),
          ...(readiness.length > 0 ? { readiness } : {}),
          ...(project !== undefined ? { project } : {}),
        };
        const result = yield* listTickets(cwd, selector);
        switch (result.tag) {
          case "ok": {
            const rendered = config.json ? renderJson(result.tickets) : renderList(result.tickets);
            yield* Effect.sync(() => stdout.write(rendered.endsWith("\n") ? rendered : `${rendered}\n`));
            return;
          }
          case "cycle":
            return yield* Effect.fail(new Error(`blocker cycle: [${result.ids.join(", ")}]`));
          case "no-project":
            return yield* Effect.fail(
              new Error(`no map for project "${result.project}"; maps: ${result.projects.join(", ") || "none"}`),
            );
        }
      }),
  ).pipe(Command.withDescription("List tickets, filtered by type, readiness, or project"));

  return Command.make("bearing", {}).pipe(
    Command.withSubcommands([init, show, backlog, fog, ls]),
    Command.withDescription("Track work too large for one session"),
  );
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
  output: OutputWriters,
): Promise<number> => {
  const program = Command.runWith(command, { version: BEARING_VERSION })(args);
  const exit = await Effect.runPromise(program.pipe(Effect.provide(buildLayer(output)), Effect.exit));
  return exitStatus(exit, output.stderr);
};

export const main = async (
  args: readonly string[],
  stdout: Writer = process.stdout,
  stderr: Writer = process.stderr,
  cwd: string = process.cwd(),
  setup: SetupRunner = runSetup,
): Promise<number> => {
  const command = buildCommand(cwd, setup, stdout);
  return runCommand(command, args, { stdout, stderr });
};

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
