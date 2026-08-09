import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { parseTicketFile } from "#src/ticket.ts";

const parsed = (basename: string, content: string) => {
  const result = parseTicketFile(basename, content);
  if (Result.isFailure(result)) {
    throw new Error(`expected success, got: ${result.failure.message}`);
  }
  return result.success;
};

const BUILD_TICKET = `---
type: build
project: mvp
blockers: [2z1qew, kwjvxc]
---

# The first slice: ls over a real tracker

## Background

Body text.
`;

describe("parseTicketFile", () => {
  it("parses a ticket file into its value", () => {
    expect(parsed("t4frt1-the-first-slice.md", BUILD_TICKET)).toEqual({
      id: "t4frt1",
      slug: "the-first-slice",
      title: "The first slice: ls over a real tracker",
      type: "build",
      project: "mvp",
      blockers: ["2z1qew", "kwjvxc"],
      clears: [],
    });
  });

  it("reads a design ticket with no project as empty rather than failing", () => {
    const content = `---
type: design
---

# A question

Body.
`;
    const ticket = parsed("a1b2c3-a-question.md", content);
    expect(ticket.type).toBe("design");
    expect(ticket.project).toBeUndefined();
    expect(ticket.blockers).toEqual([]);
    expect(ticket.clears).toEqual([]);
  });

  it("fails when the filename is not <id>-<slug>.md", () => {
    const result = parseTicketFile("readme.md", BUILD_TICKET);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.file).toBe("readme.md");
    }
  });

  it("fails when the frontmatter block is missing", () => {
    const result = parseTicketFile("a1b2c3-no-frontmatter.md", "# A title\n\nBody.\n");
    expect(Result.isFailure(result)).toBe(true);
  });

  it("fails when the frontmatter has an unknown type", () => {
    const result = parseTicketFile("a1b2c3-bad-type.md", "---\ntype: epic\n---\n\n# A title\n");
    expect(Result.isFailure(result)).toBe(true);
  });
});
