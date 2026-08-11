import { Clock, Data, Effect, FileSystem, Path, Result } from "effect";
import { parse as parseYaml } from "yaml";

const TRACKER_DIRECTORIES = ["backlog", "tickets", "maps"] as const;
const FRONTMATTER_FIELDS = new Set(["type", "project", "blockers"]);
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const ITEM_FILENAME_PATTERN = /^([0-9abcdefghjkmnpqrstvwxyz]{6})-([a-z0-9_]+(?:-[a-z0-9_]+)*)\.md$/;
const MAX_SLUG_LENGTH = 60;
const CROCKFORD_BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";
const ID_LENGTH = 6;
const ID_SPACE = 32n ** BigInt(ID_LENGTH);
const MAP_SECTIONS = [
  "Destination",
  "Notes",
  "Trail",
  "Not yet committed",
  "Not yet specified",
  "Out of scope",
] as const;

type TrackerDirectory = (typeof TRACKER_DIRECTORIES)[number];
type DiagnosticSource = "structure" | "filename" | "frontmatter" | "document";

export interface TrackerDiagnostic {
  readonly path: string;
  readonly source: DiagnosticSource;
  readonly message: string;
}

export class TrackerReadError extends Data.TaggedError("TrackerReadError")<{
  readonly operation: "discover" | "stat" | "read-directory" | "read-file";
  readonly path: string;
  readonly message: string;
}> {}

export class TrackerNotFoundError extends Data.TaggedError("TrackerNotFoundError")<{
  readonly startDirectory: string;
  readonly message: string;
}> {}

export class MalformedTrackerError extends Data.TaggedError("MalformedTrackerError")<{
  readonly diagnostics: readonly TrackerDiagnostic[];
  readonly message: string;
}> {}

interface ItemIdentity {
  readonly id: string;
  readonly slug: string;
}

export interface BacklogItem extends ItemIdentity {}

export interface MapEntry {
  readonly heading: string;
  readonly source: string;
}

export interface TrailRow {
  readonly id: string;
  readonly decision: string;
  readonly outcome: string;
  readonly source: string;
}

export interface MapDocument {
  readonly project: string;
  readonly destination: string;
  readonly intentions: readonly MapEntry[];
  readonly patches: readonly MapEntry[];
  readonly trail: readonly TrailRow[];
}

interface DocumentInput {
  readonly filename: string;
  readonly path: string;
  readonly source: string;
}

export type TicketType = "design" | "build";

export interface Ticket {
  readonly id: string;
  readonly slug: string;
  readonly type: TicketType;
  readonly project: string | undefined;
  readonly blockers: readonly string[];
}

export interface DocumentObservation<Value> {
  readonly filename: string;
  readonly path: string;
  readonly source: string;
  readonly parsed: Result.Result<Value, readonly TrackerDiagnostic[]>;
}

export interface TrackerObservation {
  readonly root: string;
  readonly backlog: readonly DocumentObservation<BacklogItem>[];
  readonly tickets: readonly DocumentObservation<Ticket>[];
  readonly maps: readonly DocumentObservation<MapDocument>[];
  readonly diagnostics: readonly TrackerDiagnostic[];
}

export interface ValidTrackerObservation {
  readonly root: string;
  readonly backlog: readonly (Omit<DocumentObservation<BacklogItem>, "parsed"> & {
    readonly parsed: Result.Success<BacklogItem, readonly TrackerDiagnostic[]>;
  })[];
  readonly tickets: readonly (Omit<DocumentObservation<Ticket>, "parsed"> & {
    readonly parsed: Result.Success<Ticket, readonly TrackerDiagnostic[]>;
  })[];
  readonly maps: readonly (Omit<DocumentObservation<MapDocument>, "parsed"> & {
    readonly parsed: Result.Success<MapDocument, readonly TrackerDiagnostic[]>;
  })[];
  readonly diagnostics: readonly [];
}

export const documentBody = (source: string): string =>
  source
    .replace(FRONTMATTER_PATTERN, "")
    .replace(/^\r?\n/, "")
    .trimEnd();

type AcquisitionError = TrackerReadError;

const readError = (operation: TrackerReadError["operation"], path: string, detail: string): TrackerReadError =>
  new TrackerReadError({
    operation,
    path,
    message: `cannot ${operation.replaceAll("-", " ")} ${path}: ${detail}`,
  });

const diagnostic = (path: string, source: DiagnosticSource, message: string): TrackerDiagnostic => ({
  path,
  source,
  message,
});

const parseItemIdentity = ({
  path,
  filename,
}: DocumentInput): Result.Result<ItemIdentity, readonly TrackerDiagnostic[]> => {
  const match = ITEM_FILENAME_PATTERN.exec(filename);
  if (match === null) {
    return Result.fail([diagnostic(path, "filename", "filename is not <six-character-id>-<slug>.md")]);
  }
  const slug = match[2] ?? "";
  if (slug.length > MAX_SLUG_LENGTH) {
    return Result.fail([diagnostic(path, "filename", `slug must be at most ${MAX_SLUG_LENGTH} characters`)]);
  }
  return Result.succeed({ id: match[1] ?? "", slug });
};

const deriveSlug = (title: string): string => {
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
  const hyphen = slug.slice(0, MAX_SLUG_LENGTH + 1).lastIndexOf("-");
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

export const mintItemIdentity = (observation: ValidTrackerObservation, title: string): Effect.Effect<ItemIdentity> =>
  Effect.gen(function* () {
    const existing = new Set([
      ...observation.backlog.map((document) => document.parsed.success.id),
      ...observation.tickets.map((document) => document.parsed.success.id),
    ]);
    let id = encodeId(yield* Clock.currentTimeNanos);
    while (existing.has(id)) {
      id = encodeId(yield* Clock.currentTimeNanos);
    }
    return { id, slug: deriveSlug(title) };
  });

const parseStringList = (
  path: string,
  field: "blockers",
  value: unknown,
  diagnostics: TrackerDiagnostic[],
): readonly string[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    diagnostics.push(diagnostic(path, "frontmatter", `${field} must be a list of strings`));
    return [];
  }
  return value;
};

const parseTicket = (document: DocumentInput): Result.Result<Ticket, readonly TrackerDiagnostic[]> => {
  const { path, source } = document;
  const diagnostics: TrackerDiagnostic[] = [];
  const identity = parseItemIdentity(document);
  if (Result.isFailure(identity)) {
    diagnostics.push(...identity.failure);
  }

  const frontmatterMatch = FRONTMATTER_PATTERN.exec(source);
  if (frontmatterMatch === null) {
    diagnostics.push(diagnostic(path, "frontmatter", "missing frontmatter block"));
    return Result.fail(diagnostics);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(frontmatterMatch[1] ?? "");
  } catch (error) {
    diagnostics.push(diagnostic(path, "frontmatter", error instanceof Error ? error.message : String(error)));
    return Result.fail(diagnostics);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    diagnostics.push(diagnostic(path, "frontmatter", "frontmatter is not a mapping"));
    return Result.fail(diagnostics);
  }

  const fields = parsed as Record<string, unknown>;
  for (const field of Object.keys(fields)) {
    if (!FRONTMATTER_FIELDS.has(field)) {
      diagnostics.push(diagnostic(path, "frontmatter", `unknown frontmatter field: ${field}`));
    }
  }

  if (fields.type !== "design" && fields.type !== "build") {
    diagnostics.push(diagnostic(path, "frontmatter", "type must be design or build"));
  }
  if (fields.project !== undefined && typeof fields.project !== "string") {
    diagnostics.push(diagnostic(path, "frontmatter", "project must be a string"));
  }
  const blockers = parseStringList(path, "blockers", fields.blockers, diagnostics);

  if (diagnostics.length > 0 || Result.isFailure(identity)) {
    return Result.fail(diagnostics);
  }

  return Result.succeed({
    ...identity.success,
    type: fields.type as Ticket["type"],
    project: fields.project as string | undefined,
    blockers,
  });
};

const parseBacklogItem = (document: DocumentInput): Result.Result<BacklogItem, readonly TrackerDiagnostic[]> => {
  const { path, source } = document;
  const identity = parseItemIdentity(document);
  const diagnostics = Result.isFailure(identity) ? [...identity.failure] : [];
  if (source.startsWith("---\n") || source.startsWith("---\r\n")) {
    diagnostics.push(diagnostic(path, "document", "backlog items must not have frontmatter"));
  }
  return diagnostics.length > 0 ? Result.fail(diagnostics) : identity;
};

interface Heading {
  readonly line: number;
  readonly level: number;
  readonly title: string;
}

const splitTableRow = (row: string): readonly string[] => {
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < row.length; index++) {
    const character = row[index];
    if (character === "\\" && row[index + 1] === "|") {
      current += "|";
      index++;
    } else if (character === "|") {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current);
  return cells;
};

const parseTrail = (
  path: string,
  content: readonly string[],
): { readonly rows: readonly TrailRow[]; readonly diagnostics: readonly TrackerDiagnostic[] } => {
  const rows: TrailRow[] = [];
  const diagnostics: TrackerDiagnostic[] = [];
  let sawData = false;
  for (const line of content) {
    if (!/^\s*\|/.test(line)) {
      continue;
    }
    const trimmed = line.trim();
    const body = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
    const inner = body.endsWith("|") ? body.slice(0, -1) : body;
    const cells = splitTableRow(inner);
    if (cells.length >= 1 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()))) {
      continue;
    }
    if (!sawData && cells.length >= 1 && cells[0]?.trim().toLowerCase() === "id") {
      continue;
    }
    sawData = true;
    if (cells.length < 3 || (cells[0] ?? "").trim().length === 0) {
      diagnostics.push(diagnostic(path, "document", "trail row must be <id> | <decision> | <outcome>"));
      continue;
    }
    rows.push({
      id: (cells[0] ?? "").trim(),
      decision: (cells[1] ?? "").trim(),
      outcome: cells.slice(2).join("|"),
      source: line,
    });
  }
  return { rows, diagnostics };
};

const parseMap = ({
  path,
  filename,
  source,
}: DocumentInput): Result.Result<MapDocument, readonly TrackerDiagnostic[]> => {
  const diagnostics: TrackerDiagnostic[] = [];
  const project = filename.slice(0, -3);
  if (project.length === 0) {
    diagnostics.push(diagnostic(path, "filename", "map filename must have a non-empty stem"));
  }

  const lines = source.split(/\r?\n/);
  const headings: Heading[] = [];
  let fence: string | undefined;
  for (const [lineNumber, line] of lines.entries()) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1] ?? "";
      if (fence === undefined) {
        fence = marker;
      } else if (marker[0] === fence[0] && marker.length >= fence.length && (fenceMatch[2] ?? "").trim().length === 0) {
        fence = undefined;
      }
      continue;
    }
    if (fence === undefined) {
      const headingMatch = /^(#{1,6})[ \t]+(.+?)\s*$/.exec(line);
      if (headingMatch !== null) {
        const level = (headingMatch[1] ?? "").length;
        const title = (headingMatch[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trimEnd();
        headings.push({ line: lineNumber, level, title });
      }
    }
  }
  const sectionHeadings = headings.filter((heading) => heading.level === 2);
  const sectionTitles = sectionHeadings.map((heading) => heading.title);
  for (const section of MAP_SECTIONS) {
    const count = sectionTitles.filter((heading) => heading === section).length;
    if (count === 0) {
      diagnostics.push(diagnostic(path, "document", `missing ## ${section} section`));
    } else if (count > 1) {
      diagnostics.push(diagnostic(path, "document", `duplicate ## ${section} section`));
    }
  }
  for (const heading of sectionTitles) {
    if (!MAP_SECTIONS.includes(heading as (typeof MAP_SECTIONS)[number])) {
      diagnostics.push(diagnostic(path, "document", `unknown ## ${heading} section`));
    }
  }
  if (
    sectionTitles.length === MAP_SECTIONS.length &&
    sectionTitles.some((heading, index) => heading !== MAP_SECTIONS[index])
  ) {
    diagnostics.push(diagnostic(path, "document", "map sections are out of order"));
  }

  const destination = sectionHeadings.find((heading) => heading.title === "Destination");
  let destinationText = "";
  if (destination !== undefined) {
    const nextHeading = sectionHeadings.find((heading) => heading.line > destination.line);
    destinationText = lines
      .slice(destination.line + 1, nextHeading?.line)
      .join("\n")
      .trim();
    if (destinationText.length === 0) {
      diagnostics.push(diagnostic(path, "document", "Destination section must not be empty"));
    }
  }

  const entriesIn = (sectionTitle: string): readonly MapEntry[] => {
    const section = sectionHeadings.find((heading) => heading.title === sectionTitle);
    if (section === undefined) {
      return [];
    }
    const next = sectionHeadings.find((heading) => heading.line > section.line);
    const end = next?.line ?? lines.length;
    return headings
      .filter((heading) => heading.level === 3 && heading.line > section.line && heading.line < end)
      .map((heading) => ({ heading: heading.title, source: lines[heading.line] ?? "" }));
  };

  const trail = sectionHeadings.find((heading) => heading.title === "Trail");
  let trailRows: readonly TrailRow[] = [];
  if (trail !== undefined) {
    const next = sectionHeadings.find((heading) => heading.line > trail.line);
    const parsedTrail = parseTrail(path, lines.slice(trail.line + 1, next?.line));
    trailRows = parsedTrail.rows;
    diagnostics.push(...parsedTrail.diagnostics);
  }

  return diagnostics.length > 0
    ? Result.fail(diagnostics)
    : Result.succeed({
        project,
        destination: destinationText,
        intentions: entriesIn("Not yet committed"),
        patches: entriesIn("Not yet specified"),
        trail: trailRows,
      });
};

const parseDocument = (directory: TrackerDirectory, document: DocumentInput) => {
  switch (directory) {
    case "backlog":
      return parseBacklogItem(document);
    case "tickets":
      return parseTicket(document);
    case "maps":
      return parseMap(document);
  }
};

const malformedError = (diagnostics: readonly TrackerDiagnostic[]): MalformedTrackerError =>
  new MalformedTrackerError({
    diagnostics,
    message: `malformed tracker:\n${diagnostics.map((finding) => `${finding.path}: ${finding.message}`).join("\n")}`,
  });

export const discoverTracker = (
  startDirectory: string,
): Effect.Effect<
  string,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const start = path.resolve(startDirectory);
    let current = start;

    while (true) {
      const candidate = path.join(current, ".bearing");
      const link = yield* Effect.result(fs.readLink(candidate));
      if (Result.isSuccess(link)) {
        return yield* Effect.fail(
          malformedError([diagnostic(candidate, "structure", ".bearing must not be a symbolic link")]),
        );
      }
      const exists = yield* fs
        .exists(candidate)
        .pipe(Effect.mapError((error) => readError("discover", candidate, error.message)));
      if (exists) {
        return candidate;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return yield* Effect.fail(
          new TrackerNotFoundError({
            startDirectory: start,
            message: `no .bearing tracker found from ${start}`,
          }),
        );
      }
      current = parent;
    }
  });

const readDocuments = (
  tracker: string,
  directory: TrackerDirectory,
): Effect.Effect<
  readonly DocumentObservation<BacklogItem | Ticket | MapDocument>[],
  AcquisitionError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directoryPath = path.join(tracker, directory);
    const filenames = yield* fs
      .readDirectory(directoryPath)
      .pipe(Effect.mapError((error) => readError("read-directory", directoryPath, error.message)));

    return yield* Effect.forEach(
      filenames.filter((filename) => filename.endsWith(".md")).sort(),
      (filename) =>
        Effect.gen(function* () {
          const documentPath = path.join(directoryPath, filename);
          const info = yield* fs
            .stat(documentPath)
            .pipe(Effect.mapError((error) => readError("stat", documentPath, error.message)));
          if (info.type !== "File") {
            return {
              filename,
              path: documentPath,
              source: "",
              parsed: Result.fail([diagnostic(documentPath, "structure", "Markdown tracker entry must be a file")]),
            };
          }
          const source = yield* fs
            .readFileString(documentPath)
            .pipe(Effect.mapError((error) => readError("read-file", documentPath, error.message)));
          const document = { filename, path: documentPath, source };
          return {
            ...document,
            parsed: parseDocument(directory, document),
          };
        }),
      { concurrency: 1 },
    );
  });

const inspectDirectory = (
  directoryPath: string,
  name: string,
): Effect.Effect<TrackerDiagnostic | undefined, TrackerReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* Effect.result(fs.stat(directoryPath));
    if (Result.isFailure(result)) {
      if (result.failure.reason._tag === "NotFound") {
        return diagnostic(directoryPath, "structure", `${name} directory is missing`);
      }
      return yield* Effect.fail(readError("stat", directoryPath, result.failure.message));
    }
    return result.success.type === "Directory"
      ? undefined
      : diagnostic(directoryPath, "structure", `${name} must be a directory`);
  });

export const acquireTracker = (
  tracker: string,
): Effect.Effect<TrackerObservation, AcquisitionError | MalformedTrackerError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const rootDiagnostic = yield* inspectDirectory(tracker, ".bearing");
    const directoryDiagnostics = rootDiagnostic
      ? TRACKER_DIRECTORIES.map((directory) =>
          diagnostic(path.join(tracker, directory), "structure", `${directory} directory is missing`),
        )
      : yield* Effect.forEach(
          TRACKER_DIRECTORIES,
          (directory) => inspectDirectory(path.join(tracker, directory), directory),
          { concurrency: 1 },
        );
    const structureDiagnostics = [rootDiagnostic, ...directoryDiagnostics].filter(
      (finding): finding is TrackerDiagnostic => finding !== undefined,
    );
    const canRead = (directory: TrackerDirectory) =>
      !structureDiagnostics.some((finding) => finding.path === path.join(tracker, directory));
    const backlog = canRead("backlog") ? yield* readDocuments(tracker, "backlog") : [];
    const tickets = canRead("tickets") ? yield* readDocuments(tracker, "tickets") : [];
    const maps = canRead("maps") ? yield* readDocuments(tracker, "maps") : [];
    const observations = [...backlog, ...tickets, ...maps];
    const diagnostics = [
      ...structureDiagnostics,
      ...observations.flatMap((observation) =>
        Result.isFailure(observation.parsed) ? observation.parsed.failure : [],
      ),
    ];
    return {
      root: tracker,
      backlog: backlog as readonly DocumentObservation<BacklogItem>[],
      tickets: tickets as readonly DocumentObservation<Ticket>[],
      maps: maps as readonly DocumentObservation<MapDocument>[],
      diagnostics,
    };
  });

export const requireValidTracker = (
  observation: TrackerObservation,
): Effect.Effect<ValidTrackerObservation, MalformedTrackerError> =>
  observation.diagnostics.length === 0
    ? Effect.succeed(observation as ValidTrackerObservation)
    : Effect.fail(malformedError(observation.diagnostics));
