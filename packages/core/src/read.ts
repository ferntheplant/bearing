import { Data, Effect, FileSystem, Path, Result, Schema } from "effect";
import { parse as parseYaml } from "yaml";

type TicketType = "design" | "build";

export interface Ticket {
  readonly id: string;
  readonly slug: string;
  readonly type: TicketType;
  readonly project: string | undefined;
  readonly blockers: readonly string[];
  readonly clears: readonly string[];
}

export class TrackerReadError extends Data.TaggedError("TrackerReadError")<{
  readonly message: string;
}> {}

const TicketTypeSchema = Schema.Literals(["design", "build"] as const);
const FrontmatterSchema = Schema.Struct({
  type: TicketTypeSchema,
  project: Schema.optionalKey(Schema.String),
  blockers: Schema.optionalKey(Schema.Array(Schema.String)),
  clears: Schema.optionalKey(Schema.Array(Schema.String)),
});
const decodeFrontmatter = Schema.decodeUnknownSync(FrontmatterSchema);
const FRONTMATTER_FIELDS = new Set(["type", "project", "blockers", "clears"]);
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const parseTicketFile = (basename: string, content: string): Result.Result<Ticket, string> => {
  const stem = basename.endsWith(".md") ? basename.slice(0, -3) : "";
  const hyphen = stem.indexOf("-");
  if (hyphen <= 0 || hyphen === stem.length - 1) {
    return Result.fail("filename is not <id>-<slug>.md");
  }

  const frontmatterMatch = FRONTMATTER_PATTERN.exec(content);
  if (frontmatterMatch === null) {
    return Result.fail("missing frontmatter block");
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(frontmatterMatch[1] ?? "");
  } catch (error) {
    return Result.fail(error instanceof Error ? error.message : String(error));
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return Result.fail("frontmatter is not a mapping");
  }

  const raw = parsed as Record<string, unknown>;
  const unknownField = Object.keys(raw).find((field) => !FRONTMATTER_FIELDS.has(field));
  if (unknownField !== undefined) {
    return Result.fail(`unknown frontmatter field: ${unknownField}`);
  }

  try {
    const frontmatter = decodeFrontmatter(raw);
    return Result.succeed({
      id: stem.slice(0, hyphen),
      slug: stem.slice(hyphen + 1),
      type: frontmatter.type,
      project: frontmatter.project,
      blockers: frontmatter.blockers ?? [],
      clears: frontmatter.clears ?? [],
    });
  } catch (error) {
    return Result.fail(error instanceof Error ? error.message : String(error));
  }
};

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
          return yield* Effect.fail(new TrackerReadError({ message: `cannot parse ${fullPath}: ${parsed.failure}` }));
        }
        return parsed.success;
      });
    return yield* Effect.forEach(names.filter((name) => name.endsWith(".md")).sort(), readTicket, { concurrency: 1 });
  });
