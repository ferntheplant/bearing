import { Clock, Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { applyCapture, deriveSlug, planCapture } from "#src/capture.ts";

import { directory, file, Harness, layer, link, type FsEntry } from "./fs-harness.ts";

const WORKSPACE = "/workspace";
const TRACKER = `${WORKSPACE}/.bearing`;

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

const TRACKER_ENTRIES: Readonly<Record<string, FsEntry>> = {
  [`${TRACKER}/backlog`]: directory(),
  [`${TRACKER}/tickets`]: directory(),
  [`${TRACKER}/maps`]: directory(),
  [`${TRACKER}/maps/mvp.md`]: file(VALID_MAP),
};

const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";
const ID_PATTERN = /^[0-9abcdefghjkmnpqrstvwxyz]{6}$/;

const decodeId = (id: string): bigint => {
  let value = 0n;
  for (const char of id) {
    value = value * 32n + BigInt(CROCKFORD.indexOf(char));
  }
  return value;
};

const fakeClock = (values: readonly bigint[]): Clock.Clock => {
  let index = 0;
  const next = () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0n;
    index += 1;
    return value;
  };
  return {
    currentTimeMillisUnsafe: () => 1,
    currentTimeMillis: Effect.succeed(1),
    currentTimeNanosUnsafe: () => next(),
    currentTimeNanos: Effect.sync(() => next()),
    sleep: () => Effect.void,
  };
};

const clockLayer = (values: readonly bigint[]) => Layer.succeed(Clock.Clock, fakeClock(values));

const runPlan = (entries: Readonly<Record<string, FsEntry>>, title: string, nanos: readonly bigint[]) => {
  const harness = new Harness(entries);
  return Effect.runPromise(
    Effect.provide(planCapture(`${WORKSPACE}/nested`, title), Layer.merge(layer(harness), clockLayer(nanos))),
  );
};

describe("deriveSlug", () => {
  it("lowercases, strips to word characters, and turns spaces into hyphens", () => {
    expect(deriveSlug("Capture a backlog item")).toBe("capture-a-backlog-item");
    expect(deriveSlug("Fix bug 3.1")).toBe("fix-bug-31");
    expect(deriveSlug("don't stop")).toBe("dont-stop");
    expect(deriveSlug("C++ compiler")).toBe("c-compiler");
  });

  it("collapses runs of separators and trims the ends", () => {
    expect(deriveSlug("  leading   spaces  ")).toBe("leading-spaces");
    expect(deriveSlug("a - b")).toBe("a-b");
    expect(deriveSlug("dash--between")).toBe("dash-between");
  });

  it("falls back to untitled when nothing survives slugification", () => {
    expect(deriveSlug("!!!")).toBe("untitled");
    expect(deriveSlug("")).toBe("untitled");
    expect(deriveSlug("...---...")).toBe("untitled");
  });

  it("truncates over 60 characters at the last hyphen that fits, never mid-word", () => {
    const long = "the-quick-brown-fox-jumps-over-the-lazy-dog-and-keeps-running-through-the-forest";
    expect(long.length).toBeGreaterThan(60);
    const slug = deriveSlug(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toBe("the-quick-brown-fox-jumps-over-the-lazy-dog-and-keeps");
  });

  it("falls back to untitled when a single word is too long to truncate at a hyphen", () => {
    const singleWord = "a".repeat(70);
    expect(deriveSlug(singleWord)).toBe("untitled");
  });

  it("keeps underscores as word characters", () => {
    expect(deriveSlug("a_custom_slug")).toBe("a_custom_slug");
  });
});

describe("planCapture", () => {
  it("plans a file in the nearest ancestor's backlog carrying the title as a heading and no frontmatter", async () => {
    const plan = await runPlan(TRACKER_ENTRIES, "Capture a backlog item", [decodeId("1a2b3c")]);

    expect(plan.id).toBe("1a2b3c");
    expect(plan.slug).toBe("capture-a-backlog-item");
    expect(plan.source).toBe("# Capture a backlog item\n");
    expect(plan.path).toBe(`${TRACKER}/backlog/1a2b3c-capture-a-backlog-item.md`);
  });

  it("mints ids from the Crockford alphabet without i, l, o, or u", async () => {
    const ids = new Set<string>();
    for (let index = 0; index < 20; index++) {
      const plan = await runPlan(TRACKER_ENTRIES, `Item ${index}`, [BigInt(index + 1)]);
      expect(plan.id).toMatch(ID_PATTERN);
      expect(plan.id).not.toMatch(/[ilou]/);
      ids.add(plan.id);
    }
    expect(ids.size).toBe(20);
  });

  it("refuses to mint an id already present in the tracker", async () => {
    const entries = {
      ...TRACKER_ENTRIES,
      [`${TRACKER}/backlog/c1d2e3-captured.md`]: file("# Captured\n"),
    };
    const plan = await runPlan(entries, "Fresh item", [decodeId("c1d2e3"), decodeId("4e5f6g")]);

    expect(plan.id).toBe("4e5f6g");
  });

  it("fails when the clock can only produce colliding ids", async () => {
    const entries = {
      ...TRACKER_ENTRIES,
      [`${TRACKER}/backlog/c1d2e3-captured.md`]: file("# Captured\n"),
    };
    await expect(runPlan(entries, "Fresh item", [decodeId("c1d2e3")])).rejects.toMatchObject({
      _tag: "IdMintError",
      attempts: 100,
    });
  });

  it("refuses a malformed tracker rather than planning against it", async () => {
    const entries = { ...TRACKER_ENTRIES, [`${TRACKER}/backlog/bad.md`]: file("---\ntype: build\n---\n") };
    await expect(runPlan(entries, "Fresh item", [decodeId("1a2b3c")])).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
    });
  });

  it("refuses a nearest .bearing symlink rather than searching farther upward", async () => {
    const entries = {
      [`${WORKSPACE}/.bearing`]: link("/elsewhere"),
    };
    await expect(runPlan(entries, "Fresh item", [decodeId("1a2b3c")])).rejects.toMatchObject({
      _tag: "MalformedTrackerError",
    });
  });
});

describe("applyCapture", () => {
  it("writes the planned source to the planned path", async () => {
    const harness = new Harness({ ...TRACKER_ENTRIES, [`${TRACKER}/backlog`]: directory() });
    const plan = {
      id: "1a2b3c",
      slug: "capture-a-backlog-item",
      title: "Capture a backlog item",
      source: "# Capture a backlog item\n",
      path: `${TRACKER}/backlog/1a2b3c-capture-a-backlog-item.md`,
    };

    const result = await Effect.runPromise(Effect.provide(applyCapture(plan), layer(harness)));

    expect(result).toEqual({
      id: "1a2b3c",
      slug: "capture-a-backlog-item",
      path: `${TRACKER}/backlog/1a2b3c-capture-a-backlog-item.md`,
    });
    expect(harness.entries.get(`${TRACKER}/backlog/1a2b3c-capture-a-backlog-item.md`)).toEqual(
      file("# Capture a backlog item\n"),
    );
  });

  it("reports a write failure as a CaptureWriteError", async () => {
    const harness = new Harness(
      { ...TRACKER_ENTRIES, [`${TRACKER}/backlog`]: directory() },
      { operation: "write-file", path: `${TRACKER}/backlog/1a2b3c-capture-a-backlog-item.md` },
    );
    const plan = {
      id: "1a2b3c",
      slug: "capture-a-backlog-item",
      title: "Capture a backlog item",
      source: "# Capture a backlog item\n",
      path: `${TRACKER}/backlog/1a2b3c-capture-a-backlog-item.md`,
    };

    await expect(Effect.runPromise(Effect.provide(applyCapture(plan), layer(harness)))).rejects.toMatchObject({
      _tag: "CaptureWriteError",
      operation: "write-file",
      path: `${TRACKER}/backlog/1a2b3c-capture-a-backlog-item.md`,
    });
  });
});
