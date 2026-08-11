import { Effect, FileSystem, Layer, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { resolveId, showItem } from "#src/analysis.ts";

const TRACKER = "/workspace/.bearing";
const VALID_MAP = `# MVP

## Destination

Ship bearing.

## Notes

## Trail

## Not yet committed

### Ship a reader

## Not yet specified

### Reader depth

## Out of scope
`;

const TICKETS = {
  "a1b2c3-first.md": `---
type: design
project: mvp
---

# This body is opaque
`,
  "a2b3c4-third.md": `---
type: build
---

Third.
`,
  "b1c2d3-second.md": `---
type: build
blockers: [a1b2c3]
---

Body.
`,
};

const BACKLOG = {
  "c1d2e3-captured.md": "# Captured idea\n\nLong prose.\n",
};

interface Fixture {
  readonly backlog: Record<string, string>;
  readonly tickets: Record<string, string>;
  readonly maps: Record<string, string>;
}

const fixture = (overrides: Partial<Fixture> = {}): Fixture => ({
  backlog: BACKLOG,
  tickets: TICKETS,
  maps: { "mvp.md": VALID_MAP },
  ...overrides,
});

const directoryInfo = { type: "Directory" } as FileSystem.File.Info;
const fileInfo = { type: "File" } as FileSystem.File.Info;

const layer = (files: Fixture) =>
  Layer.merge(
    FileSystem.layerNoop({
      exists: (path) => Effect.succeed(path === TRACKER),
      stat: (path) =>
        Effect.succeed(
          path === TRACKER || ["backlog", "tickets", "maps"].some((directory) => path === `${TRACKER}/${directory}`)
            ? directoryInfo
            : fileInfo,
        ),
      readDirectory: (path) => {
        const directory = path.split("/").at(-1) as keyof Fixture;
        return Effect.succeed(Object.keys(files[directory]));
      },
      readFileString: (path) => {
        const parts = path.split("/");
        const filename = parts.at(-1) ?? "";
        const directory = parts.at(-2) as keyof Fixture;
        return Effect.succeed(files[directory][filename] ?? "");
      },
    }),
    Path.layer,
  );

const runResolve = (files: Fixture, prefix: string) =>
  Effect.runPromise(Effect.provide(resolveId("/workspace/nested", prefix), layer(files)));

const runShow = (files: Fixture, prefix: string) =>
  Effect.runPromise(Effect.provide(showItem("/workspace/nested", prefix), layer(files)));

describe("resolveId", () => {
  it("resolves a full six-character id to its ticket", async () => {
    const result = await runResolve(fixture(), "a1b2c3");

    expect(result).toEqual({
      tag: "match",
      item: {
        kind: "ticket",
        id: "a1b2c3",
        slug: "first",
        path: `${TRACKER}/tickets/a1b2c3-first.md`,
      },
    });
  });

  it("resolves an unambiguous prefix of a ticket id", async () => {
    const result = await runResolve(fixture(), "b1c2");

    expect(result).toEqual({
      tag: "match",
      item: {
        kind: "ticket",
        id: "b1c2d3",
        slug: "second",
        path: `${TRACKER}/tickets/b1c2d3-second.md`,
      },
    });
  });

  it("resolves a backlog item across the whole tracker", async () => {
    const result = await runResolve(fixture(), "c1d2e3");

    expect(result).toEqual({
      tag: "match",
      item: {
        kind: "backlog",
        id: "c1d2e3",
        slug: "captured",
        path: `${TRACKER}/backlog/c1d2e3-captured.md`,
      },
    });
  });

  it("returns every candidate id for an ambiguous prefix", async () => {
    const result = await runResolve(fixture(), "a");

    expect(result).toEqual({
      tag: "ambiguous",
      prefix: "a",
      candidates: [
        { kind: "ticket", id: "a1b2c3", slug: "first", path: `${TRACKER}/tickets/a1b2c3-first.md` },
        { kind: "ticket", id: "a2b3c4", slug: "third", path: `${TRACKER}/tickets/a2b3c4-third.md` },
      ],
    });
  });

  it("returns a distinguishable no-match refusal", async () => {
    const result = await runResolve(fixture(), "zzzz");

    expect(result).toEqual({ tag: "no-match", prefix: "zzzz" });
  });

  it("reports two items sharing an id as ambiguous rather than choosing one", async () => {
    const files = fixture({
      backlog: { ...BACKLOG, "a1b2c3-duplicate.md": "# Duplicate\n" },
    });

    const result = await runResolve(files, "a1b2c3");

    expect(result).toEqual({
      tag: "ambiguous",
      prefix: "a1b2c3",
      candidates: [
        { kind: "backlog", id: "a1b2c3", slug: "duplicate", path: `${TRACKER}/backlog/a1b2c3-duplicate.md` },
        { kind: "ticket", id: "a1b2c3", slug: "first", path: `${TRACKER}/tickets/a1b2c3-first.md` },
      ],
    });
  });

  it("refuses a malformed tracker rather than resolving against it", async () => {
    const files = fixture({
      tickets: { ...TICKETS, "bad.md": "no frontmatter\n" },
    });

    await expect(runResolve(files, "a1b2c3")).rejects.toMatchObject({ _tag: "MalformedTrackerError" });
  });
});

describe("showItem", () => {
  it("returns a ticket's frontmatter fields, body, and exact source", async () => {
    const result = await runShow(fixture(), "a1b2c3");

    expect(result).toEqual({
      tag: "resolved",
      item: {
        kind: "ticket",
        id: "a1b2c3",
        slug: "first",
        type: "design",
        project: "mvp",
        blockers: [],
        body: "# This body is opaque",
        source: TICKETS["a1b2c3-first.md"],
      },
    });
  });

  it("returns a backlog item as the same kind of value", async () => {
    const result = await runShow(fixture(), "c1d2e3");

    expect(result).toEqual({
      tag: "resolved",
      item: {
        kind: "backlog",
        id: "c1d2e3",
        slug: "captured",
        body: "# Captured idea\n\nLong prose.",
        source: BACKLOG["c1d2e3-captured.md"],
      },
    });
  });

  it("returns a no-match refusal", async () => {
    const result = await runShow(fixture(), "zzzz");

    expect(result).toEqual({ tag: "no-match", prefix: "zzzz" });
  });

  it("returns an ambiguous refusal carrying the candidates", async () => {
    const files = fixture({
      backlog: { ...BACKLOG, "a1b2c3-duplicate.md": "# Duplicate\n" },
    });

    const result = await runShow(files, "a1b2");

    expect(result).toEqual({
      tag: "ambiguous",
      prefix: "a1b2",
      candidates: [
        { kind: "backlog", id: "a1b2c3", slug: "duplicate", path: `${TRACKER}/backlog/a1b2c3-duplicate.md` },
        { kind: "ticket", id: "a1b2c3", slug: "first", path: `${TRACKER}/tickets/a1b2c3-first.md` },
      ],
    });
  });

  it("resolves against the nearest ancestor tracker from a nested directory", async () => {
    const files = fixture({
      backlog: { "c1d2e3-captured.md": "# Nested\n" },
    });

    const result = await Effect.runPromise(
      Effect.provide(showItem("/workspace/nested/deep/down", "c1d2e3"), layer(files)),
    );

    expect(result).toEqual({
      tag: "resolved",
      item: { kind: "backlog", id: "c1d2e3", slug: "captured", body: "# Nested", source: "# Nested\n" },
    });
  });
});
