import type { FogReport, ListedTicket, ShowItem } from "@bearing/core";
import { describe, expect, it } from "vite-plus/test";

import { renderFog, renderJson, renderList, renderShow } from "#src/render.ts";

const TICKETS: readonly ListedTicket[] = [
  {
    id: "t4frt1",
    slug: "the-first-slice",
    type: "build",
    project: "mvp",
    blockers: [],
    ready: true,
    blockedBy: [],
    unblocks: ["2z1qew"],
  },
  {
    id: "2z1qew",
    slug: "skill-installation-mechanics",
    type: "design",
    project: "mvp",
    blockers: ["kwjvxc"],
    ready: false,
    blockedBy: ["kwjvxc"],
    unblocks: [],
  },
  {
    id: "a1b2c3",
    slug: "unprojected",
    type: "build",
    project: undefined,
    blockers: [],
    ready: true,
    blockedBy: [],
    unblocks: [],
  },
];

describe("renderList", () => {
  it("renders each ticket with its id, title, type, project, and readiness", () => {
    const text = renderList(TICKETS);
    expect(text).toContain("t4frt1  the first slice  build  mvp  ready");
    expect(text).toContain("2z1qew  skill installation mechanics  design  mvp  blocked");
    expect(text).toContain("a1b2c3  unprojected  build  -  ready");
  });

  it("shows named blockers and both blocking closures where present", () => {
    const text = renderList(TICKETS);
    expect(text).toContain("blockers: [kwjvxc]");
    expect(text).toContain("blocked by: [kwjvxc]");
    expect(text).toContain("unblocks: [2z1qew]");
    expect(text).not.toContain("blockers: []");
    expect(text).not.toContain("blocked by: []");
    expect(text).not.toContain("unblocks: []");
  });

  it("renders an empty list as an empty string", () => {
    expect(renderList([])).toBe("");
  });
});

const FOG_REPORTS: readonly FogReport[] = [
  { project: "mvp", patches: [{ heading: "Reader depth", source: "### Reader depth" }] },
  { project: "second", patches: [] },
];

describe("renderFog", () => {
  it("groups each map's patches under its project", () => {
    expect(renderFog(FOG_REPORTS)).toBe("mvp\n  Reader depth\n\nsecond");
  });

  it("prints a map with no patches as its bare project", () => {
    expect(renderFog([FOG_REPORTS[1] as FogReport])).toBe("second");
  });

  it("renders an empty report as an empty string", () => {
    expect(renderFog([])).toBe("");
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
