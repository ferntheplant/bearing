#!/usr/bin/env bun

import {
  applyCreation,
  applyMapClose,
  applyRemoval,
  applyRetitle,
  applyTriage,
  checkTracker,
  deriveFrontier,
  listBacklog,
  listFog,
  listTickets,
  planCapture,
  planClose,
  planMapClose,
  planRemove,
  planRetitle,
  planTicketCreation,
  planTriage,
  RemovalError,
  RetitleError,
  showItem,
  TicketCreationError,
  TriageError,
  type TicketSelector,
  type TicketType,
  type TriageVerdict,
} from "@bearing/core";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { Cause, Console, Effect, Exit, Layer, Option, Sink, Stdio, Stream, Terminal } from "effect";
import { Argument, CliConfig, CliError, CliOutput, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";

import {
  renderBacklogList,
  renderCheck,
  renderCreation,
  renderDesignClose,
  renderFog,
  renderFrontier,
  renderJson,
  renderList,
  renderMapClose,
  renderRemoval,
  renderRemovalError,
  renderRetitle,
  renderRetitleError,
  renderSetupOutcome,
  renderShow,
  renderTicketCreationError,
  renderTriage,
  renderTriageError,
} from "./render.ts";
import { runSetup, type SetupRunner } from "./setup.ts";
import { ansiStyle, plainStyle, type Style } from "./style.ts";
import { BEARING_VERSION } from "./version.ts";

const SUPPORTED_SHELLS = ["bash", "zsh", "fish"] as const;
type SupportedShell = (typeof SUPPORTED_SHELLS)[number];

interface Writer {
  write(text: string): unknown;
}

export interface OutputWriters {
  readonly stdout: Writer;
  readonly stderr: Writer;
}

/**
 * The `bearing doctor` command renders its report to stdout and then fails with
 * this sentinel when any of them is an error, so the process exits 1. `exitStatus`
 * maps it back to 1 without writing anything else, because the rendered findings
 * already carried the distinction (ADR 0035).
 */
class IntegrityCheckFailed extends Error {
  constructor() {
    super("integrity check found errors");
    this.name = "IntegrityCheckFailed";
  }
}

const makeConsole = ({ stdout, stderr }: OutputWriters): Console.Console => {
  // Console.log is a println, so every write ends in a newline. Command handlers
  // write through the raw writers and terminate their own output; this path
  // carries the framework's help and errors, which do not.
  const toStdout = (...args: ReadonlyArray<unknown>) => {
    stdout.write(`${args.map(String).join(" ")}\n`);
  };
  const toStderr = (...args: ReadonlyArray<unknown>) => {
    stderr.write(`${args.map(String).join(" ")}\n`);
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

/**
 * `--json` applies to every command, so it is parsed once for the whole tree
 * rather than declared on each one. Handlers read it out of the context the
 * runner provides.
 */
const JsonOutput = GlobalFlag.setting("json")({
  flag: Flag.boolean("json").pipe(Flag.withDescription("Emit this command's value as JSON")),
});

const buildLayer = (output: OutputWriters, colors: boolean) =>
  Layer.mergeAll(
    BunFileSystem.layer,
    BunPath.layer,
    Layer.succeed(Console.Console, makeConsole(output)),
    CliOutput.layer(CliOutput.defaultFormatter({ colors })),
    CliConfig.layer({ builtIns: [GlobalFlag.Help] }),
    Layer.succeed(Terminal.Terminal, dieTerminal),
    Layer.succeed(Stdio.Stdio, dieStdio),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, dieSpawner),
  );

const buildCommand = (cwd: string, setup: SetupRunner, stdout: Writer, style: Style) => {
  const emit = (rendered: string) =>
    Effect.sync(() => stdout.write(rendered.endsWith("\n") ? rendered : `${rendered}\n`));

  // The completion command generates from the whole tree, so the handler reads
  // the root command this function returns rather than one of its own inputs.
  // It is assigned before any handler runs, but after every subcommand exists.
  let rootCommand: Command.Command.Any;

  /**
   * The framework derives a completion descriptor from the command tree and
   * renders it through its own `--completions` action; bearing routes the
   * action's Console output back through its own writers so the script is a
   * value the handler can also emit as `--json`. Nothing here names a command,
   * so the generated script always covers the tree that exists (ADR 0019).
   */
  const generateCompletions = (
    shell: SupportedShell,
  ): Effect.Effect<string, never, Console.Console | CliConfig.CliConfig> =>
    Effect.gen(function* () {
      const { builtIns } = yield* CliConfig.CliConfig;
      let captured = "";
      const capture = makeConsole({
        stdout: { write: (chunk) => void (captured += chunk) },
        stderr: { write: () => undefined },
      });
      yield* GlobalFlag.Completions.run(Option.some(shell), {
        command: rootCommand,
        commandPath: ["bearing"],
        version: BEARING_VERSION,
        builtIns,
      }).pipe(Effect.provideService(Console.Console, capture));
      // The framework's install comments assume the `--completions` built-in
      // flag, which bearing pins off and replaces with `bearing completion`
      // (docs/gotchas.md). Rewrite the reference so the shipped script names
      // the command that actually exists.
      return captured
        .replace(/\n+$/, "")
        .replaceAll(`${rootCommand.name} --completions `, `${rootCommand.name} completion `);
    });

  const init = Command.make("init", {}, () =>
    Effect.gen(function* () {
      const outcome = yield* Effect.tryPromise({
        try: () => setup(cwd),
        catch: (error) => error,
      });
      const json = yield* JsonOutput;
      yield* emit(json ? renderJson(outcome) : renderSetupOutcome(outcome, style));
    }),
  ).pipe(Command.withDescription("Create a tracker and install the bearing wayfinder skill"));

  const show = Command.make(
    "show",
    {
      id: Argument.string("id").pipe(Argument.withDescription("An id, or a prefix of one")),
      full: Flag.boolean("full").pipe(Flag.withDescription("Print the file's exact source")),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        if (config.full && json) {
          return yield* Effect.fail(new Error("--full and --json cannot be used together"));
        }
        const result = yield* showItem(cwd, config.id);
        switch (result.tag) {
          case "resolved": {
            const rendered = json
              ? renderJson(result.item)
              : config.full
                ? result.item.source
                : renderShow(result.item, style);
            yield* emit(rendered);
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
    {
      title: Argument.optional(
        Argument.string("title").pipe(Argument.withDescription("What to capture; omit to list the backlog")),
      ),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const title = Option.getOrUndefined(config.title);
        if (title === undefined) {
          const items = yield* listBacklog(cwd);
          yield* emit(json ? renderJson(items) : renderBacklogList(items, style));
          return;
        }
        const plan = yield* planCapture(cwd, title);
        const result = yield* applyCreation(plan);
        yield* emit(json ? renderJson(result) : renderCreation(result, style));
      }),
  ).pipe(Command.withDescription("Capture a backlog item, or list the backlog when called bare"));

  const add = Command.make(
    "add",
    {
      // The framework appends a choice's values to a flag's help text but not to
      // an argument's, so the values are written out here (docs/gotchas.md).
      type: Argument.choice("type", ["build", "design"]).pipe(
        Argument.withDescription("build | design — a build ticket closes as a commit, a design ticket as an artifact"),
      ),
      title: Argument.string("title").pipe(Argument.withDescription("What the ticket is called")),
      project: Flag.optional(
        Flag.string("project").pipe(
          Flag.withDescription("The map this ticket belongs to; required for a design ticket"),
        ),
      ),
    },
    (config: { readonly type: TicketType; readonly title: string; readonly project: Option.Option<string> }) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const plan = yield* planTicketCreation(cwd, config.type, config.title, Option.getOrUndefined(config.project));
        const result = yield* applyCreation(plan);
        yield* emit(json ? renderJson(result) : renderCreation(result, style));
      }),
  ).pipe(Command.withDescription("Create a build or design ticket"));

  const fog = Command.make(
    "fog",
    {
      project: Argument.optional(
        Argument.string("project").pipe(Argument.withDescription("One map; omit for every map")),
      ),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const project = Option.getOrUndefined(config.project);
        const result = yield* listFog(cwd, project);
        switch (result.tag) {
          case "fog":
            yield* emit(json ? renderJson(result.maps) : renderFog(result.maps, style));
            return;
          case "no-project":
            return yield* Effect.fail(
              new Error(`no map for project "${result.project}"; maps: ${result.projects.join(", ") || "none"}`),
            );
        }
      }),
  ).pipe(Command.withDescription("List the fog patches on one map, or across every map"));

  const doctor = Command.make("doctor", {}, () =>
    Effect.gen(function* () {
      const json = yield* JsonOutput;
      const result = yield* checkTracker(cwd);
      yield* emit(json ? renderJson(result) : renderCheck(result, style));
      if (result.findings.some((finding) => finding.severity === "error")) {
        return yield* Effect.fail(new IntegrityCheckFailed());
      }
    }),
  ).pipe(Command.withDescription("Run every tracker integrity check and report what each one found"));

  const next = Command.make("next", {}, () =>
    Effect.gen(function* () {
      const json = yield* JsonOutput;
      const result = yield* deriveFrontier(cwd);
      switch (result.tag) {
        case "ok":
          yield* emit(json ? renderJson(result.frontier) : renderFrontier(result.frontier, style));
          return;
        case "cycle":
          return yield* Effect.fail(new Error(`blocker cycle: [${result.ids.join(", ")}]`));
      }
    }),
  ).pipe(Command.withDescription("Show the frontier: ready build work, ready decisions, and the backlog count"));

  const ls = Command.make(
    "ls",
    {
      build: Flag.boolean("build").pipe(Flag.withDescription("Only build tickets")),
      design: Flag.boolean("design").pipe(Flag.withDescription("Only design tickets")),
      ready: Flag.boolean("ready").pipe(Flag.withDescription("Only tickets with no open blocker")),
      blocked: Flag.boolean("blocked").pipe(Flag.withDescription("Only tickets waiting on a blocker")),
      project: Flag.optional(Flag.string("project").pipe(Flag.withDescription("Only tickets on this map"))),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
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
          case "ok":
            yield* emit(json ? renderJson(result.tickets) : renderList(result.tickets, style));
            return;
          case "cycle":
            return yield* Effect.fail(new Error(`blocker cycle: [${result.ids.join(", ")}]`));
          case "no-project":
            return yield* Effect.fail(
              new Error(`no map for project "${result.project}"; maps: ${result.projects.join(", ") || "none"}`),
            );
        }
      }),
  ).pipe(Command.withDescription("List tickets, filtered by type, readiness, or project"));

  const close = Command.make(
    "close",
    {
      id: Argument.optional(Argument.string("id").pipe(Argument.withDescription("An id, or a prefix of one"))),
      map: Flag.string("map").pipe(Flag.withDescription("Close the map with this filename stem"), Flag.atMost(1)),
      confirm: Flag.boolean("confirm").pipe(Flag.withHidden),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const id = Option.getOrUndefined(config.id);
        const project = config.map[0];
        if (project !== undefined) {
          if (id !== undefined) {
            return yield* Effect.fail(new Error("bearing close takes one target: an id or --map <project>"));
          }
          const plan = yield* planMapClose(cwd, project);
          const result = yield* applyMapClose(plan);
          yield* emit(json ? renderJson(result) : renderMapClose(result, style));
          return;
        }
        if (id === undefined) {
          return yield* Effect.fail(new Error("bearing close needs an id or --map <project>"));
        }
        const plan = yield* planClose(cwd, id);
        if (plan.kind === "design" && !config.confirm) {
          yield* emit(json ? renderJson(plan) : renderDesignClose(plan, style));
          return;
        }
        const result = yield* applyRemoval(plan);
        yield* emit(json ? renderJson(result) : renderRemoval(result, style));
      }),
  ).pipe(Command.withDescription("Close a ticket or map, deleting it from the tracker"));

  const rm = Command.make(
    "rm",
    { id: Argument.string("id").pipe(Argument.withDescription("An id, or a prefix of one")) },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const plan = yield* planRemove(cwd, config.id);
        const result = yield* applyRemoval(plan);
        yield* emit(json ? renderJson(result) : renderRemoval(result, style));
      }),
  ).pipe(
    Command.withDescription("Delete a ticket or backlog item immediately, stripping its id from every blocker list"),
  );

  const retitle = Command.make(
    "retitle",
    {
      id: Argument.string("id").pipe(Argument.withDescription("An id, or a prefix of one")),
      title: Argument.string("title").pipe(Argument.withDescription("What the ticket should be called instead")),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const plan = yield* planRetitle(cwd, config.id, config.title);
        const result = yield* applyRetitle(plan);
        yield* emit(json ? renderJson(result) : renderRetitle(result, style));
      }),
  ).pipe(Command.withDescription("Rename a ticket from a new title without changing its contents"));

  const triage = Command.make(
    "triage",
    {
      id: Argument.string("id").pipe(Argument.withDescription("An id, or a prefix of one")),
      ticket: Flag.boolean("ticket").pipe(Flag.withDescription("Promote the item to a build ticket with no project")),
      to: Flag.optional(Flag.string("to").pipe(Flag.withDescription("Promote the item into the named map"))),
      drop: Flag.boolean("drop").pipe(Flag.withDescription("Delete the backlog item")),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const chosen = [
          ...(config.ticket ? ["--ticket"] : []),
          ...(Option.isSome(config.to) ? [`--to ${config.to.value}`] : []),
          ...(config.drop ? ["--drop"] : []),
        ];
        if (chosen.length === 0) {
          return yield* Effect.fail(new Error("bearing triage needs a verdict: --ticket, --to <project>, or --drop"));
        }
        if (chosen.length > 1) {
          return yield* Effect.fail(new Error(`bearing triage takes one verdict, not: ${chosen.join(", ")}`));
        }
        const verdict: TriageVerdict = config.ticket
          ? { kind: "ticket" }
          : Option.isSome(config.to)
            ? { kind: "project", project: config.to.value }
            : { kind: "drop" };
        const plan = yield* planTriage(cwd, config.id, verdict);
        const result = yield* applyTriage(plan);
        yield* emit(json ? renderJson(result) : renderTriage(result, style));
      }),
  ).pipe(Command.withDescription("Triage a backlog item into a ticket or delete it"));

  const completion = Command.make(
    "completion",
    {
      shell: Argument.optional(Argument.choice("shell", SUPPORTED_SHELLS)).pipe(
        Argument.withDescription(`${SUPPORTED_SHELLS.join(" | ")} — which shell to generate completions for`),
      ),
    },
    (config) =>
      Effect.gen(function* () {
        const json = yield* JsonOutput;
        const shell = Option.getOrUndefined(config.shell);
        if (shell === undefined) {
          return yield* Effect.fail(new Error(`bearing completion needs a shell: ${SUPPORTED_SHELLS.join(" | ")}`));
        }
        const script = yield* generateCompletions(shell);
        yield* emit(json ? renderJson({ shell, script }) : script);
      }),
  ).pipe(Command.withDescription("Generate shell completions for the named shell"));

  // A bare invocation prints help, the way every other CLI answers "what is
  // this?" (ADR 0044). `bearing next` is the only way to the frontier.
  rootCommand = Command.make("bearing", {}, () =>
    Effect.fail(new CliError.ShowHelp({ commandPath: ["bearing"], errors: [] })),
  ).pipe(
    Command.withSubcommands([init, show, backlog, add, fog, doctor, next, ls, close, rm, retitle, triage, completion]),
    Command.withGlobalFlags([JsonOutput]),
    Command.withDescription("Track work across sessions"),
  );
  return rootCommand;
};

const exitStatus = (exit: Exit.Exit<void, unknown>, stderr: Writer): number => {
  if (Exit.isSuccess(exit)) return 0;
  const error = Cause.squash(exit.cause);
  if (CliError.isCliError(error)) {
    // A pure help request exits 0; every parse error exits 1. The framework
    // already rendered help and errors through the Console service.
    return error._tag === "ShowHelp" && error.errors.length === 0 ? 0 : 1;
  }
  if (error instanceof IntegrityCheckFailed) {
    // The rendered findings already went to stdout; the exit status only
    // carries the error/no-error verdict (ADR 0035).
    return 1;
  }
  if (error instanceof RemovalError) {
    stderr.write(`error: ${renderRemovalError(error)}\n`);
    return 1;
  }
  if (error instanceof RetitleError) {
    stderr.write(`error: ${renderRetitleError(error)}\n`);
    return 1;
  }
  if (error instanceof TicketCreationError) {
    stderr.write(`error: ${renderTicketCreationError(error)}\n`);
    return 1;
  }
  if (error instanceof TriageError) {
    stderr.write(`error: ${renderTriageError(error)}\n`);
    return 1;
  }
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`error: ${message}\n`);
  return 1;
};

export const runCommand = async <Name extends string, Input, E, ContextInput>(
  command: Command.Command<Name, Input, ContextInput, E, Command.Environment>,
  args: readonly string[],
  output: OutputWriters,
  colors = false,
): Promise<number> => {
  const program = Command.runWith(command, { version: BEARING_VERSION })(args);
  const exit = await Effect.runPromise(program.pipe(Effect.provide(buildLayer(output, colors)), Effect.exit));
  return exitStatus(exit, output.stderr);
};

/**
 * Colour is for a person watching a terminal. `NO_COLOR` is the standing
 * convention for turning it off, and a destination that is not a terminal — a
 * pipe, a file, an agent reading the output — never wants escape sequences
 * (ADR 0041).
 *
 * Per the `NO_COLOR` convention the variable suppresses colour when it is
 * present and non-empty; setting it to the empty string is not setting it.
 * Both inputs are parameters so the decision can be tested without a terminal.
 */
export const colorsWanted = (
  env: Readonly<Record<string, string | undefined>> = process.env,
  isTTY: boolean | undefined = process.stdout.isTTY,
): boolean => (env["NO_COLOR"] ?? "") === "" && isTTY === true;

export const main = async (
  args: readonly string[],
  stdout: Writer = process.stdout,
  stderr: Writer = process.stderr,
  cwd: string = process.cwd(),
  setup: SetupRunner = runSetup,
  colors: boolean = colorsWanted(),
): Promise<number> => {
  const command = buildCommand(cwd, setup, stdout, colors ? ansiStyle : plainStyle);
  return runCommand(command, args, { stdout, stderr }, colors);
};

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
