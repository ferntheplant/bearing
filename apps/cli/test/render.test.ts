import type { ShowItem, Ticket } from "@bearing/core";
import { describe, expect, it } from "vite-plus/test";

import { renderJson, renderShow, renderText } from "#src/render.ts";

const TICKETS: readonly Ticket[] = [
  {
    id: "t4frt1",
    slug: "the-first-slice",
    type: "build",
    project: "mvp",
    blockers: [],
  },
  {
    id: "2z1qew",
    slug: "skill-installation-mechanics",
    type: "design",
    project: "mvp",
    blockers: ["kwjvxc"],
  },
  {
    id: "a1b2c3",
    slug: "unprojected",
    type: "build",
    project: undefined,
    blockers: [],
  },
];

describe("renderText", () => {
  it("renders each ticket with its id, title, type, and project", () => {
    const text = renderText(TICKETS);
    expect(text).toContain("t4frt1  the first slice  build  mvp");
    expect(text).toContain("2z1qew  skill installation mechanics  design  mvp");
    expect(text).toContain("a1b2c3  unprojected  build  -");
  });

  it("shows blockers where present and omits empty blocker metadata", () => {
    const text = renderText(TICKETS);
    expect(text).toContain("blockers: [kwjvxc]");
    expect(text).not.toContain("blockers: []");
  });

  it("renders an empty list as an empty string", () => {
    expect(renderText([])).toBe("");
  });
});

describe("renderJson", () => {
  it("round-trips the fields rather than the rendered text", () => {
    const parsed = JSON.parse(renderJson(TICKETS)) as unknown[];
    expect(parsed).toEqual(TICKETS);
    expect(parsed[1]).toMatchObject({
      id: "2z1qew",
      slug: "skill-installation-mechanics",
      type: "design",
      project: "mvp",
      blockers: ["kwjvxc"],
    });
  });

  it("renders an empty list as an empty array", () => {
    expect(renderJson([])).toBe("[]");
  });
});

const TICKET_SHOW: ShowItem = {
  kind: "ticket",
  id: "a1b2c3",
  slug: "the-first-slice",
  type: "design",
  project: "mvp",
  blockers: ["kwjvxc"],
  body: "# The first slice\n\nBody.",
  source: "---\ntype: design\nproject: mvp\nblockers: [kwjvxc]\n---\n\n# The first slice\n\nBody.\n",
};

const BACKLOG_SHOW: ShowItem = {
  kind: "backlog",
  id: "c1d2e3",
  slug: "a-captured-idea",
  body: "# A captured idea\n\nProse.",
  source: "# A captured idea\n\nProse.\n",
};

describe("renderShow", () => {
  it("renders a ticket's frontmatter fields and body", () => {
    const text = renderShow(TICKET_SHOW);
    expect(text).toBe("type: design\nproject: mvp\nblockers: [kwjvxc]\n\n# The first slice\n\nBody.");
  });

  it("renders a backlog item's body without frontmatter fields", () => {
    expect(renderShow(BACKLOG_SHOW)).toBe("# A captured idea\n\nProse.");
  });
});

describe("renderJson", () => {
  it("round-trips a show item through the same value serializer", () => {
    expect(JSON.parse(renderJson(TICKET_SHOW))).toEqual(TICKET_SHOW);
  });
});
