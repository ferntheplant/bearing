import { Clock, Data, Effect, FileSystem, Path, Result } from "effect";
import { isMap, isScalar, isSeq, parseDocument as parseYamlDocument } from "yaml";

const TRACKER_DIRECTORIES = ["backlog", "tickets", "maps"] as const;
const FRONTMATTER_FIELDS = new Set(["type", "project", "blockers"]);
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const SLUG_SOURCE = "[a-z0-9_]+(?:-[a-z0-9_]+)*";
const ITEM_FILENAME_PATTERN = new RegExp(`^([0-9abcdefghjkmnpqrstvwxyz]{6})-(${SLUG_SOURCE})\\.md$`);
const MAP_FILENAME_PATTERN = new RegExp(`^(${SLUG_SOURCE})\\.md$`);
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
  readonly kind: "parse" | "unknown-type";
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

interface MapDestination {
  readonly text: string;
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
  readonly destination: MapDestination;
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

export interface BlockersSyntax {
  readonly fieldStart: number;
  readonly fieldEnd: number;
  readonly valueStart: number;
  readonly valueEnd: number;
  readonly style: "flow" | "block";
  readonly indent: number;
  readonly lineEnding: string;
}

interface TicketSyntax {
  readonly blockers: BlockersSyntax | undefined;
}

export interface DocumentObservation<Value> {
  readonly filename: string;
  readonly path: string;
  readonly source: string;
  readonly itemId: string | undefined;
  readonly parsed: Result.Result<Value, readonly TrackerDiagnostic[]>;
}

interface TicketDocumentObservation extends DocumentObservation<Ticket> {
  readonly syntax: TicketSyntax;
}

export interface TrackerObservation {
  readonly root: string;
  readonly backlog: readonly DocumentObservation<BacklogItem>[];
  readonly tickets: readonly TicketDocumentObservation[];
  readonly maps: readonly DocumentObservation<MapDocument>[];
  readonly diagnostics: readonly TrackerDiagnostic[];
}

export interface ValidTrackerObservation {
  readonly root: string;
  readonly backlog: readonly (Omit<DocumentObservation<BacklogItem>, "parsed"> & {
    readonly parsed: Result.Success<BacklogItem, readonly TrackerDiagnostic[]>;
  })[];
  readonly tickets: readonly (Omit<TicketDocumentObservation, "parsed"> & {
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

const diagnostic = (
  path: string,
  source: DiagnosticSource,
  message: string,
  kind: TrackerDiagnostic["kind"] = "parse",
): TrackerDiagnostic => ({
  kind,
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

const parseTicket = (
  document: DocumentInput,
): {
  readonly parsed: Result.Result<Ticket, readonly TrackerDiagnostic[]>;
  readonly syntax: TicketSyntax;
} => {
  const { path, source } = document;
  const diagnostics: TrackerDiagnostic[] = [];
  let syntax: TicketSyntax = { blockers: undefined };
  const identity = parseItemIdentity(document);
  if (Result.isFailure(identity)) {
    diagnostics.push(...identity.failure);
  }

  const frontmatterMatch = FRONTMATTER_PATTERN.exec(source);
  if (frontmatterMatch === null) {
    diagnostics.push(diagnostic(path, "frontmatter", "missing frontmatter block"));
    return { parsed: Result.fail(diagnostics), syntax };
  }

  const frontmatter = frontmatterMatch[1] ?? "";
  const frontmatterStart = frontmatterMatch[0].indexOf(frontmatter);
  let parsed: unknown;
  let yamlDocument: ReturnType<typeof parseYamlDocument>;
  try {
    yamlDocument = parseYamlDocument(frontmatter, { keepSourceTokens: true });
    if (yamlDocument.errors.length > 0) {
      throw yamlDocument.errors[0];
    }
    parsed = yamlDocument.toJS();
  } catch (error) {
    diagnostics.push(diagnostic(path, "frontmatter", error instanceof Error ? error.message : String(error)));
    return { parsed: Result.fail(diagnostics), syntax };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    diagnostics.push(diagnostic(path, "frontmatter", "frontmatter is not a mapping"));
    return { parsed: Result.fail(diagnostics), syntax };
  }

  const fields = parsed as Record<string, unknown>;
  for (const field of Object.keys(fields)) {
    if (!FRONTMATTER_FIELDS.has(field)) {
      diagnostics.push(diagnostic(path, "frontmatter", `unknown frontmatter field: ${field}`));
    }
  }

  if (fields.type !== "design" && fields.type !== "build") {
    diagnostics.push(diagnostic(path, "frontmatter", "type must be design or build", "unknown-type"));
  }
  if (fields.project !== undefined && typeof fields.project !== "string") {
    diagnostics.push(diagnostic(path, "frontmatter", "project must be a string"));
  }
  const blockers = parseStringList(path, "blockers", fields.blockers, diagnostics);

  if (Array.isArray(fields.blockers) && fields.blockers.every((entry) => typeof entry === "string")) {
    const pair = isMap(yamlDocument.contents)
      ? yamlDocument.contents.items.find((item) => isScalar(item.key) && item.key.value === "blockers")
      : undefined;
    if (pair === undefined || !isScalar(pair.key) || !isSeq(pair.value)) {
      diagnostics.push(diagnostic(path, "frontmatter", "blockers must be a directly editable YAML sequence"));
    } else {
      const keyRange = pair.key.range;
      const valueRange = pair.value.range;
      if (keyRange === null || keyRange === undefined || valueRange === null || valueRange === undefined) {
        diagnostics.push(diagnostic(path, "frontmatter", "blockers sequence has no source range"));
      } else {
        const token = pair.value.srcToken;
        const style = token?.type === "block-seq" ? "block" : "flow";
        const valueNodeEnd = frontmatterStart + valueRange[2];
        const fieldEnd = source.startsWith("\r\n", valueNodeEnd)
          ? valueNodeEnd + 2
          : source[valueNodeEnd] === "\r" || source[valueNodeEnd] === "\n"
            ? valueNodeEnd + 1
            : valueNodeEnd;
        const trailing = source.slice(frontmatterStart + valueRange[1], fieldEnd);
        const lineEnding = /\r\n|\r|\n/.exec(trailing)?.[0] ?? "";
        syntax = {
          blockers: {
            fieldStart: frontmatterStart + keyRange[0],
            fieldEnd,
            valueStart: frontmatterStart + valueRange[0],
            valueEnd: style === "block" ? fieldEnd : frontmatterStart + valueRange[1],
            style,
            indent: token?.type === "block-seq" ? token.indent : 0,
            lineEnding,
          },
        };
      }
    }
  }

  if (diagnostics.length > 0 || Result.isFailure(identity)) {
    return { parsed: Result.fail(diagnostics), syntax };
  }

  return {
    parsed: Result.succeed({
      ...identity.success,
      type: fields.type as Ticket["type"],
      project: fields.project as string | undefined,
      blockers,
    }),
    syntax,
  };
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

const isEscaped = (value: string, index: number): boolean => {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
};

const splitTableRow = (row: string): readonly string[] => {
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < row.length; index++) {
    const character = row[index];
    if (character === "|" && !isEscaped(row, index)) {
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
    const openingPipe = line.indexOf("|");
    const body = line.slice(openingPipe + 1);
    const bodyWithoutTrailingWhitespace = body.trimEnd();
    const closingPipe = bodyWithoutTrailingWhitespace.length - 1;
    const inner =
      bodyWithoutTrailingWhitespace[closingPipe] === "|" && !isEscaped(bodyWithoutTrailingWhitespace, closingPipe)
        ? bodyWithoutTrailingWhitespace.slice(0, closingPipe)
        : body;
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
  const filenameMatch = MAP_FILENAME_PATTERN.exec(filename);
  const project = filenameMatch?.[1] ?? "";
  if (filenameMatch === null) {
    diagnostics.push(diagnostic(path, "filename", "map filename is not <slug>.md"));
  } else if (project.length > MAX_SLUG_LENGTH) {
    diagnostics.push(diagnostic(path, "filename", `slug must be at most ${MAX_SLUG_LENGTH} characters`));
  }

  const sourceLines = source.match(/[^\r\n]*(?:\r\n|\n|$)/g)?.filter((line) => line.length > 0) ?? [];
  const lines = sourceLines.map((line) => line.replace(/\r?\n$/, ""));
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

  const sectionEnd = (section: Heading): number =>
    sectionHeadings.find((heading) => heading.line > section.line)?.line ?? lines.length;

  const destination = sectionHeadings.find((heading) => heading.title === "Destination");
  let destinationText = "";
  let destinationSource = "";
  if (destination !== undefined) {
    const end = sectionEnd(destination);
    destinationSource = sourceLines.slice(destination.line + 1, end).join("");
    destinationText = lines
      .slice(destination.line + 1, end)
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
    const end = sectionEnd(section);
    const entries = headings
      .filter((heading) => heading.level === 3 && heading.line > section.line && heading.line < end)
      .map((heading, index, matches) => ({
        heading: heading.title,
        source: sourceLines.slice(heading.line, matches[index + 1]?.line ?? end).join(""),
      }));
    return entries;
  };

  const trail = sectionHeadings.find((heading) => heading.title === "Trail");
  let trailRows: readonly TrailRow[] = [];
  if (trail !== undefined) {
    const parsedTrail = parseTrail(path, lines.slice(trail.line + 1, sectionEnd(trail)));
    trailRows = parsedTrail.rows;
    diagnostics.push(...parsedTrail.diagnostics);
  }

  return diagnostics.length > 0
    ? Result.fail(diagnostics)
    : Result.succeed({
        project,
        destination: { text: destinationText, source: destinationSource },
        intentions: entriesIn("Not yet committed"),
        patches: entriesIn("Not yet specified"),
        trail: trailRows,
      });
};

const parseDocument = (directory: TrackerDirectory, document: DocumentInput) => {
  switch (directory) {
    case "backlog":
      return { parsed: parseBacklogItem(document) };
    case "tickets":
      return parseTicket(document);
    case "maps":
      return { parsed: parseMap(document) };
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
            const identity =
              directory === "maps" ? undefined : parseItemIdentity({ filename, path: documentPath, source: "" });
            return {
              filename,
              path: documentPath,
              source: "",
              itemId: identity !== undefined && Result.isSuccess(identity) ? identity.success.id : undefined,
              parsed: Result.fail([diagnostic(documentPath, "structure", "Markdown tracker entry must be a file")]),
            };
          }
          const source = yield* fs
            .readFileString(documentPath)
            .pipe(Effect.mapError((error) => readError("read-file", documentPath, error.message)));
          const document = { filename, path: documentPath, source };
          const identity = directory === "maps" ? undefined : parseItemIdentity(document);
          return {
            ...document,
            itemId: identity !== undefined && Result.isSuccess(identity) ? identity.success.id : undefined,
            ...parseDocument(directory, document),
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
      tickets: tickets as readonly TicketDocumentObservation[],
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
