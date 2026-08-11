import type { Path } from "effect";
import { Data, Effect, FileSystem } from "effect";

import type { MalformedTrackerError, TrackerNotFoundError, TrackerReadError } from "./acquisition.ts";
import { acquireValidObservation, buildIndex, resolve, type ResolvedItem, type ResolvableEntry } from "./analysis.ts";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?\n)---(?:\r?\n|$)/;

export class RemovalError extends Data.TaggedError("RemovalError")<{
  readonly reason: "no-match" | "ambiguous" | "design-ticket" | "backlog-item";
  readonly prefix: string;
  readonly candidates: readonly string[];
  readonly message: string;
}> {}

export class RemovalApplyError extends Data.TaggedError("RemovalApplyError")<{
  readonly operation: "remove" | "write-file";
  readonly path: string;
  readonly message: string;
}> {}

export interface RemovalRewrite {
  readonly path: string;
  readonly source: string;
}

export interface RemovalPlan {
  readonly target: ResolvedItem;
  readonly rewrites: readonly RemovalRewrite[];
}

export interface RemovalApplyResult {
  readonly id: string;
  readonly removed: string;
  readonly rewrote: readonly string[];
}

type RemovalReason = RemovalError["reason"];

const refusalMessage = (reason: RemovalReason, prefix: string, candidates: readonly string[]): string => {
  switch (reason) {
    case "no-match":
      return `no item matches id prefix "${prefix}"`;
    case "ambiguous":
      return `ambiguous id prefix "${prefix}": ${candidates.join(", ")}`;
    case "design-ticket":
      return `cannot close design ticket ${prefix} with bearing close; a design ticket closes against its trail row`;
    case "backlog-item":
      return `cannot close backlog item ${prefix} with bearing close; use bearing rm`;
  }
};

const refusal = (reason: RemovalReason, prefix: string, candidates: readonly string[]): RemovalError =>
  new RemovalError({ reason, prefix, candidates, message: refusalMessage(reason, prefix, candidates) });

const splitLines = (text: string): readonly { readonly content: string; readonly start: number }[] => {
  const segments = text.split(/(\r\n|\r|\n)/);
  const lines: { content: string; start: number }[] = [];
  let offset = 0;
  for (let index = 0; index < segments.length; index += 2) {
    const content = segments[index] ?? "";
    const separator = segments[index + 1] ?? "";
    lines.push({ content: `${content}${separator}`, start: offset });
    offset += content.length + separator.length;
  }
  return lines;
};

const splice = (source: string, start: number, end: number, replacement: string): string =>
  `${source.slice(0, start)}${replacement}${source.slice(end)}`;

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const itemValue = (line: string): string => {
  const item = /^\s*-[ \t]+([^#]*?)[ \t]*$/.exec(line);
  return item === null ? "" : unquote(item[1] ?? "");
};

/**
 * A lossless rewrite of a ticket's frontmatter: everything except the `blockers` value —
 * body, other frontmatter keys, and their order — survives byte-for-byte. A list that
 * becomes empty has the `blockers` key removed rather than left as `[]`.
 */
const stripBlockers = (source: string, remains: readonly string[]): string => {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (match === null) {
    return source;
  }
  const frontmatter = match[1] ?? "";
  const frontmatterOffset = match[0].indexOf(frontmatter);
  if (frontmatterOffset < 0) {
    return source;
  }
  const frontmatterStart = match.index + frontmatterOffset;
  const lines = splitLines(frontmatter);
  const blockersIndex = lines.findIndex((line) => line.content.startsWith("blockers:"));
  if (blockersIndex === -1) {
    return source;
  }
  const blockersLine = lines[blockersIndex];
  if (blockersLine === undefined) {
    return source;
  }
  const lineStart = frontmatterStart + blockersLine.start;
  const value = blockersLine.content.replace(/^blockers:[ \t]*/, "");

  if (value.startsWith("[")) {
    const bracketStart = blockersLine.content.indexOf("[");
    const bracketEnd = blockersLine.content.indexOf("]", bracketStart);
    if (bracketEnd === -1) {
      return source;
    }
    if (remains.length === 0) {
      return splice(source, lineStart, lineStart + blockersLine.content.length, "");
    }
    const from = lineStart + bracketStart;
    const to = lineStart + bracketEnd + 1;
    return splice(source, from, to, `[${remains.join(", ")}]`);
  }

  const items: { readonly content: string; readonly id: string }[] = [];
  let cursor = blockersIndex + 1;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined || !/^\s*-[ \t]+/.test(line.content)) {
      break;
    }
    items.push({ content: line.content, id: itemValue(line.content) });
    cursor += 1;
  }
  if (items.length === 0) {
    return source;
  }
  const fieldLength = blockersLine.content.length + items.reduce((sum, item) => sum + item.content.length, 0);
  const fieldEnd = lineStart + fieldLength;
  if (remains.length === 0) {
    return splice(source, lineStart, fieldEnd, "");
  }
  const kept = items.filter((item) => remains.includes(item.id));
  const keptText = blockersLine.content + kept.map((item) => item.content).join("");
  return splice(source, lineStart, fieldEnd, keptText);
};

type RemovalMode = "close" | "remove";

const planRemoval = (
  startDirectory: string,
  prefix: string,
  mode: RemovalMode,
): Effect.Effect<
  RemovalPlan,
  RemovalError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const observation = yield* acquireValidObservation(startDirectory);
    const resolution = resolve(buildIndex(observation), prefix);
    switch (resolution.tag) {
      case "no-match":
        return yield* Effect.fail(refusal("no-match", prefix, []));
      case "ambiguous":
        return yield* Effect.fail(
          refusal(
            "ambiguous",
            prefix,
            resolution.candidates.map((entry) => entry.id),
          ),
        );
      case "match": {
        const entry: ResolvableEntry = resolution.entry;
        if (entry.kind === "ticket" && mode === "close" && entry.parsed.type === "design") {
          return yield* Effect.fail(refusal("design-ticket", entry.id, []));
        }
        if (entry.kind === "backlog" && mode === "close") {
          return yield* Effect.fail(refusal("backlog-item", entry.id, []));
        }
        const rewrites: RemovalRewrite[] = [];
        for (const document of observation.tickets) {
          const ticket = document.parsed.success;
          if (ticket.id === entry.id || !ticket.blockers.includes(entry.id)) {
            continue;
          }
          rewrites.push({
            path: document.path,
            source: stripBlockers(
              document.source,
              ticket.blockers.filter((id) => id !== entry.id),
            ),
          });
        }
        return { target: { kind: entry.kind, id: entry.id, slug: entry.slug, path: entry.path }, rewrites };
      }
    }
  });

export const planClose = (
  startDirectory: string,
  prefix: string,
): Effect.Effect<
  RemovalPlan,
  RemovalError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> => planRemoval(startDirectory, prefix, "close");

export const planRemove = (
  startDirectory: string,
  prefix: string,
): Effect.Effect<
  RemovalPlan,
  RemovalError | TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> => planRemoval(startDirectory, prefix, "remove");

export const applyRemoval = (
  plan: RemovalPlan,
): Effect.Effect<RemovalApplyResult, RemovalApplyError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .remove(plan.target.path)
      .pipe(
        Effect.mapError(
          (error) => new RemovalApplyError({ operation: "remove", path: plan.target.path, message: error.message }),
        ),
      );
    const rewrote: string[] = [];
    for (const rewrite of plan.rewrites) {
      yield* fs
        .writeFileString(rewrite.path, rewrite.source)
        .pipe(
          Effect.mapError(
            (error) => new RemovalApplyError({ operation: "write-file", path: rewrite.path, message: error.message }),
          ),
        );
      rewrote.push(rewrite.path);
    }
    return { id: plan.target.id, removed: plan.target.path, rewrote };
  });
