import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { parseFrontmatter } from "#src/frontmatter.ts";

const parsed = (yamlText: string) => {
  const result = parseFrontmatter(yamlText);
  if (Result.isFailure(result)) {
    throw new Error(`expected success, got: ${result.failure}`);
  }
  return result.success;
};

describe("parseFrontmatter", () => {
  it("parses all four fields", () => {
    expect(
      parsed(
        `type: build
project: mvp
blockers: [2z1qew, kwjvxc]
clears: [mutation-atomicity, a-patch]
`,
      ),
    ).toEqual({
      type: "build",
      project: "mvp",
      blockers: ["2z1qew", "kwjvxc"],
      clears: ["mutation-atomicity", "a-patch"],
    });
  });

  it("treats an absent list as empty", () => {
    expect(parsed("type: design\nproject: mvp\n")).toEqual({
      type: "design",
      project: "mvp",
      blockers: [],
      clears: [],
    });
  });

  it("treats a null list as empty", () => {
    expect(parsed("type: design\nblockers:\nclears:\n").blockers).toEqual([]);
    expect(parsed("type: design\nblockers:\nclears:\n").clears).toEqual([]);
  });

  it("parses a design ticket with no project", () => {
    expect(parsed("type: design\n").project).toBeUndefined();
  });

  it("ignores unknown keys", () => {
    expect(parsed("type: build\nstatus: open\n").type).toBe("build");
  });

  it("fails on an unknown type", () => {
    expect(Result.isFailure(parseFrontmatter("type: epic\n"))).toBe(true);
  });

  it("fails when type is absent", () => {
    expect(Result.isFailure(parseFrontmatter("project: mvp\n"))).toBe(true);
  });

  it("fails on invalid yaml", () => {
    expect(Result.isFailure(parseFrontmatter("type: [unclosed\n"))).toBe(true);
  });
});
