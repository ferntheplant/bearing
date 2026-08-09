import { Option, Result, Schema } from "effect";
import { parse as parseYaml } from "yaml";

import type { TicketType } from "./ticket.ts";

const TicketTypeSchema = Schema.Literals(["design", "build"] as const);

const FrontmatterSchema = Schema.Struct({
  type: TicketTypeSchema,
  project: Schema.optionalKey(Schema.String),
  blockers: Schema.optionalKey(Schema.Array(Schema.String)),
  clears: Schema.optionalKey(Schema.Array(Schema.String)),
});

export interface TicketFrontmatter {
  readonly type: TicketType;
  readonly project: string | undefined;
  readonly blockers: readonly string[];
  readonly clears: readonly string[];
}

const decodeFrontmatter = Schema.decodeUnknownSync(FrontmatterSchema);

export interface FrontmatterBlock {
  readonly yaml: string;
  readonly body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export const splitFrontmatter = (text: string): Option.Option<FrontmatterBlock> => {
  const match = FRONTMATTER_PATTERN.exec(text);
  if (match === null) {
    return Option.none();
  }
  return Option.some({ yaml: match[1] ?? "", body: text.slice(match[0].length) });
};

export const parseFrontmatter = (yamlText: string): Result.Result<TicketFrontmatter, string> => {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (error) {
    return Result.fail(error instanceof Error ? error.message : String(error));
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return Result.fail("frontmatter is not a mapping");
  }
  const raw = parsed as Record<string, unknown>;
  const input: Record<string, unknown> = { type: raw["type"] };
  if (raw["project"] != null) {
    input["project"] = raw["project"];
  }
  if (raw["blockers"] != null) {
    input["blockers"] = raw["blockers"];
  }
  if (raw["clears"] != null) {
    input["clears"] = raw["clears"];
  }
  try {
    const decoded = decodeFrontmatter(input);
    return Result.succeed({
      type: decoded.type,
      project: decoded.project,
      blockers: decoded.blockers ?? [],
      clears: decoded.clears ?? [],
    });
  } catch (error) {
    return Result.fail(error instanceof Error ? error.message : String(error));
  }
};
