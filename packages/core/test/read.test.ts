import { Effect, FileSystem, Layer, Path, PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { acquireTracker } from "#src/acquisition.ts";
import { listTickets } from "#src/read.ts";

const TRACKER = "/workspace/.bearing";
const VALID_MAP = `# MVP

## Destination

Ship bearing.

## Notes

## Trail

## Not yet specified

### Reader depth

## Out of scope
`;
const VALID_TICKETS: Record<string, string> = {
  "a1b2c3-first.md": `---
type: design
project: mvp
---

# This body is opaque
`,
  "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Body.
`,
};

interface Fixture {
  readonly backlog: Record<string, string>;
  readonly tickets: Record<string, string>;
  readonly maps: Record<string, string>;
}

interface Counters {
  readonly enumerations: Map<string, number>;
  readonly reads: Map<string, number>;
}

interface Failures {
  readonly readDirectory?: string;
  readonly readFile?: string;
  readonly nonFile?: string;
}

const fixture = (overrides: Partial<Fixture> = {}): Fixture => ({
  backlog: { "c1d2e3-captured.md": "# Exact backlog source\r\n" },
  tickets: VALID_TICKETS,
  maps: { "mvp.md": VALID_MAP },
  ...overrides,
});

const directoryInfo = { type: "Directory" } as FileSystem.File.Info;
const fileInfo = { type: "File" } as FileSystem.File.Info;

const failure = (method: string, path: string) =>
  PlatformError.systemError({
    _tag: "PermissionDenied",
    module: "FileSystem",
    method,
    pathOrDescriptor: path,
  });

const layer = (files: Fixture, counters: Counters, failures: Failures = {}) =>
  Layer.merge(
    FileSystem.layerNoop({
      exists: (path) => Effect.succeed(path === TRACKER),
      stat: (path) =>
        Effect.succeed(
          path === TRACKER || ["backlog", "tickets", "maps"].some((directory) => path === `${TRACKER}/${directory}`)
            ? directoryInfo
            : path === failures.nonFile
              ? directoryInfo
              : fileInfo,
        ),
      readDirectory: (path) => {
        counters.enumerations.set(path, (counters.enumerations.get(path) ?? 0) + 1);
        if (path.endsWith(`/${failures.readDirectory}`)) {
          return Effect.fail(failure("readDirectory", path));
        }
        const directory = path.split("/").at(-1) as keyof Fixture;
        return Effect.succeed([...Object.keys(files[directory]), ".DS_Store"]);
      },
      readFileString: (path) => {
        counters.reads.set(path, (counters.reads.get(path) ?? 0) + 1);
        if (path === failures.readFile) {
          return Effect.fail(failure("readFileString", path));
        }
        const parts = path.split("/");
        const filename = parts.at(-1) ?? "";
        const directory = parts.at(-2) as keyof Fixture;
        return Effect.succeed(files[directory][filename] ?? "");
      },
    }),
    Path.layer,
  );

const counters = (): Counters => ({ enumerations: new Map(), reads: new Map() });

const runAcquisition = (files: Fixture, counts = counters(), failures: Failures = {}) =>
  Effect.runPromise(Effect.provide(acquireTracker(TRACKER), layer(files, counts, failures)));

const runList = (files: Fixture, counts = counters(), failures: Failures = {}) =>
  Effect.runPromise(Effect.provide(listTickets("/workspace/nested"), layer(files, counts, failures)));

describe("tracker acquisition", () => {
  it("enumerates every tracker directory once, reads each Markdown file once, and retains exact source", async () => {
    const files = fixture();
    const counts = counters();

    const observation = await runAcquisition(files, counts);

    expect([...counts.enumerations.values()]).toEqual([1, 1, 1]);
    expect([...counts.reads.values()]).toEqual([1, 1, 1, 1]);
    expect([...counts.reads.keys()]).toEqual([
      `${TRACKER}/backlog/c1d2e3-captured.md`,
      `${TRACKER}/tickets/a1b2c3-first.md`,
      `${TRACKER}/tickets/b1c2d3-second.md`,
      `${TRACKER}/maps/mvp.md`,
    ]);
    expect(observation.backlog[0]?.source).toBe(files.backlog["c1d2e3-captured.md"]);
    expect(observation.tickets[0]?.source).toBe(files.tickets["a1b2c3-first.md"]);
    expect(observation.maps[0]?.source).toBe(files.maps["mvp.md"]);
  });

  it("retains all filename and frontmatter diagnostics instead of stopping at the first malformed ticket", async () => {
    const files = fixture({
      tickets: {
        "bad.md": "no frontmatter\n",
        "z9z9z9-bad.md": `---
type: unknown
status: open
clears: [a-patch]
blockers:
---
`,
      },
    });

    const observation = await runAcquisition(files);

    expect(observation.tickets).toHaveLength(2);
    expect(observation.diagnostics.map((finding) => finding.message)).toEqual([
      "filename is not <six-character-id>-<slug>.md",
      "missing frontmatter block",
      "unknown frontmatter field: status",
      "unknown frontmatter field: clears",
      "type must be design or build",
      "blockers must be a list of strings",
    ]);
    await expect(runList(files)).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ source: "filename" }),
        expect.objectContaining({ source: "frontmatter" }),
      ]),
    });
  });

  it("rejects ticket and backlog slugs longer than 60 characters", async () => {
    const slug = "a".repeat(61);
    const files = fixture({
      backlog: { [`c1d2e3-${slug}.md`]: "Captured.\n" },
      tickets: { [`a1b2c3-${slug}.md`]: VALID_TICKETS["a1b2c3-first.md"] ?? "" },
    });

    const observation = await runAcquisition(files);

    expect(observation.diagnostics).toEqual([
      expect.objectContaining({ source: "filename", message: "slug must be at most 60 characters" }),
      expect.objectContaining({ source: "filename", message: "slug must be at most 60 characters" }),
    ]);
    await expect(runList(files)).rejects.toMatchObject({ _tag: "MalformedTrackerError" });
  });

  it("refuses listing when a backlog item and map are malformed", async () => {
    const files = fixture({
      backlog: {
        "c1d2e3-captured.md": `---
status: open
---
`,
      },
      maps: { "mvp.md": "# MVP\n\n## Destination\n\nShip.\n" },
    });

    await expect(runList(files)).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
      message: expect.stringMatching(/backlog items must not have frontmatter[\s\S]*missing ## Notes section/),
    });
  });

  it("ignores section-like text in code fences and refuses unknown map sections", async () => {
    const fenced = fixture({
      maps: { "mvp.md": VALID_MAP.replace("## Trail", "```md\n## Example\n```\n\n## Trail") },
    });
    await expect(runList(fenced)).resolves.toHaveLength(2);

    const unknown = fixture({
      maps: { "mvp.md": VALID_MAP.replace("## Trail", "## Unexpected\n\nNo.\n\n## Trail") },
    });
    await expect(runList(unknown)).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
      message: expect.stringContaining("unknown ## Unexpected section"),
    });

    const malformedHeading = fixture({
      maps: { "mvp.md": VALID_MAP.replace("## Destination", "## Destination#") },
    });
    await expect(runList(malformedHeading)).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
      message: expect.stringContaining("missing ## Destination section"),
    });
  });

  it("keeps an unreadable directory separate from malformed tracker content", async () => {
    await expect(runList(fixture(), counters(), { readDirectory: "maps" })).rejects.toMatchObject({
      _tag: "TrackerReadError",
      operation: "read-directory",
      path: `${TRACKER}/maps`,
    });
  });

  it("keeps an unreadable file separate from malformed tracker content", async () => {
    const path = `${TRACKER}/tickets/a1b2c3-first.md`;
    await expect(runList(fixture(), counters(), { readFile: path })).rejects.toMatchObject({
      _tag: "TrackerReadError",
      operation: "read-file",
      path,
    });
  });

  it("treats a Markdown directory collision as malformed tracker structure", async () => {
    const path = `${TRACKER}/tickets/a1b2c3-first.md`;
    await expect(runList(fixture(), counters(), { nonFile: path })).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ path, source: "structure", message: "Markdown tracker entry must be a file" }),
      ]),
    });
  });
});

describe("listTickets", () => {
  it("projects valid tickets in filename order without changing their values", async () => {
    const tickets = await runList(fixture());

    expect(tickets).toEqual([
      {
        id: "a1b2c3",
        slug: "first",
        type: "design",
        project: "mvp",
        blockers: [],
      },
      {
        id: "b1c2d3",
        slug: "second",
        type: "build",
        project: undefined,
        blockers: ["a1b2c3"],
      },
    ]);
  });
});
