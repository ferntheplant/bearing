import { Clock, Data, Effect, FileSystem, Path } from "effect";

import {
  acquireTracker,
  discoverTracker,
  requireValidTracker,
  type MalformedTrackerError,
  type TrackerNotFoundError,
  type TrackerReadError,
} from "./acquisition.ts";

export const MAX_SLUG_LENGTH = 60;

const CROCKFORD_BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";
const ID_LENGTH = 6;
const ID_SPACE = 32n ** BigInt(ID_LENGTH);
const MAX_MINT_ATTEMPTS = 100;

export class IdMintError extends Data.TaggedError("IdMintError")<{
  readonly attempts: number;
  readonly message: string;
}> {}

export class CaptureWriteError extends Data.TaggedError("CaptureWriteError")<{
  readonly operation: "write-file";
  readonly path: string;
  readonly message: string;
}> {}

export interface CapturePlan {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly source: string;
  readonly path: string;
}

export interface CaptureApplyResult {
  readonly id: string;
  readonly slug: string;
  readonly path: string;
}

/**
 * The slug rule from ADR 0024: the title lowercased and stripped to word
 * characters, spaces, and hyphens, with spaces becoming hyphens, then
 * truncated to 60 characters at the last hyphen that fits — never mid-word —
 * falling back to `untitled` when nothing survives.
 */
export const deriveSlug = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length === 0) {
    return "untitled";
  }
  if (slug.length <= MAX_SLUG_LENGTH) {
    return slug;
  }
  const hyphen = slug.slice(0, MAX_SLUG_LENGTH).lastIndexOf("-");
  return hyphen > 0 ? slug.slice(0, hyphen) : "untitled";
};

const encodeId = (value: bigint): string => {
  let remainder = value % ID_SPACE;
  let encoded = "";
  for (let index = 0; index < ID_LENGTH; index++) {
    encoded = `${CROCKFORD_BASE32[Number(remainder % 32n)] ?? "0"}${encoded}`;
    remainder /= 32n;
  }
  return encoded;
};

const mintId = (existing: ReadonlySet<string>): Effect.Effect<string, IdMintError> =>
  Effect.gen(function* () {
    for (let attempt = 1; attempt <= MAX_MINT_ATTEMPTS; attempt++) {
      const nanos = yield* Clock.currentTimeNanos;
      const candidate = encodeId(nanos);
      if (!existing.has(candidate)) {
        return candidate;
      }
    }
    return yield* Effect.fail(
      new IdMintError({
        attempts: MAX_MINT_ATTEMPTS,
        message: `could not mint a fresh id after ${MAX_MINT_ATTEMPTS} attempts`,
      }),
    );
  });

export const planCapture = (
  startDirectory: string,
  title: string,
): Effect.Effect<
  CapturePlan,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError | IdMintError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const tracker = yield* discoverTracker(startDirectory);
    const observation = yield* acquireTracker(tracker);
    const valid = yield* requireValidTracker(observation);
    const existing = new Set([
      ...valid.backlog.map((document) => document.parsed.success.id),
      ...valid.tickets.map((document) => document.parsed.success.id),
    ]);
    const id = yield* mintId(existing);
    const slug = deriveSlug(title);
    return {
      id,
      slug,
      title,
      source: `# ${title}\n`,
      path: path.join(tracker, "backlog", `${id}-${slug}.md`),
    };
  });

export const applyCapture = (
  plan: CapturePlan,
): Effect.Effect<CaptureApplyResult, CaptureWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .writeFileString(plan.path, plan.source)
      .pipe(
        Effect.mapError(
          (error) => new CaptureWriteError({ operation: "write-file", path: plan.path, message: error.message }),
        ),
      );
    return { id: plan.id, slug: plan.slug, path: plan.path };
  });
