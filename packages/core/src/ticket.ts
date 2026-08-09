import { Data, Option, Result } from "effect";

import { parseTicketFilename } from "./filename.ts";
import { parseFrontmatter, splitFrontmatter } from "./frontmatter.ts";

export type TicketType = "design" | "build";

export interface Ticket {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly type: TicketType;
  readonly project: string | undefined;
  readonly blockers: readonly string[];
  readonly clears: readonly string[];
}

export class TicketParseError extends Data.TaggedError("TicketParseError")<{
  readonly file: string;
  readonly message: string;
}> {}

const TITLE_PATTERN = /^#\s+(.+)$/m;

const extractTitle = (body: string): string => {
  const match = TITLE_PATTERN.exec(body);
  return match === null ? "" : (match[1] ?? "").trim();
};

export const parseTicketFile = (basename: string, content: string): Result.Result<Ticket, TicketParseError> => {
  const name = parseTicketFilename(basename);
  if (Option.isNone(name)) {
    return Result.fail(new TicketParseError({ file: basename, message: "filename is not <id>-<slug>.md" }));
  }
  const block = splitFrontmatter(content);
  if (Option.isNone(block)) {
    return Result.fail(new TicketParseError({ file: basename, message: "missing frontmatter block" }));
  }
  const frontmatter = parseFrontmatter(block.value.yaml);
  if (Result.isFailure(frontmatter)) {
    return Result.fail(new TicketParseError({ file: basename, message: frontmatter.failure }));
  }
  return Result.succeed({
    id: name.value.id,
    slug: name.value.slug,
    title: extractTitle(block.value.body),
    type: frontmatter.success.type,
    project: frontmatter.success.project,
    blockers: frontmatter.success.blockers,
    clears: frontmatter.success.clears,
  });
};
