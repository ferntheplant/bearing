import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { main } from "#src/cli.ts";

const capture = () => {
  let text = "";
  return {
    writer: {
      write: (chunk: string) => {
        text += chunk;
      },
    },
    read: () => text,
  };
};

let fixtureRoot: string;
let tracker: string;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "bearing-cli-"));
  tracker = join(fixtureRoot, ".bearing");
  const tickets = join(tracker, "tickets");
  await mkdir(tickets, { recursive: true });
  await Promise.all([
    writeFile(
      join(tickets, "a1b2c3-first-ticket.md"),
      `---
type: build
---

# Body headings are opaque
`,
    ),
    writeFile(
      join(tickets, "b1c2d3-design-question.md"),
      `---
type: design
project: mvp
blockers: [a1b2c3]
clears: [a-patch]
---

Question body.
`,
    ),
  ]);
});

afterAll(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

describe("main", () => {
  it("lists a real tracker through the entrypoint", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([tracker], stdout.writer, stderr.writer);

    expect(exitCode).toBe(0);
    expect(stderr.read()).toBe("");
    expect(stdout.read()).toBe(
      "a1b2c3  first ticket  build  -\n" +
        "b1c2d3  design question  design  mvp\n" +
        "        blockers: [a1b2c3]  clears: [a-patch]\n",
    );
  });

  it("emits the same ticket values as JSON", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["--json", tracker], stdout.writer, stderr.writer);

    expect(exitCode).toBe(0);
    expect(stderr.read()).toBe("");
    expect(JSON.parse(stdout.read())).toEqual([
      {
        id: "a1b2c3",
        slug: "first-ticket",
        type: "build",
        blockers: [],
        clears: [],
      },
      {
        id: "b1c2d3",
        slug: "design-question",
        type: "design",
        project: "mvp",
        blockers: ["a1b2c3"],
        clears: ["a-patch"],
      },
    ]);
  });

  it("returns a usage error when the tracker argument is absent", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([], stdout.writer, stderr.writer);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toBe("usage: bearing [--json] <tracker>\n");
  });

  it("returns a read error when the tracker does not exist", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main([join(fixtureRoot, "missing")], stdout.writer, stderr.writer);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain("error: cannot read");
  });
});
