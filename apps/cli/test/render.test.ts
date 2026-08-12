import { RemovalError, type FogReport, type Frontier, type ListedTicket, type ShowItem } from "@bearing/core";
import { describe, expect, it } from "vite-plus/test";

import { renderFog, renderFrontier, renderJson, renderList, renderRemovalError, renderShow } from "#src/render.ts";
import { ansiStyle, plainStyle } from "#src/style.ts";

/** The escape byte, spelled out so no regex literal carries a control character. */
const ESC = "\u001B";

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

const FOG_REPORTS: readonly FogReport[] = [
  { project: "mvp", patches: [{ heading: "Reader depth", source: "### Reader depth" }] },
  { project: "second", patches: [] },
];

const FRONTIER: Frontier = {
  build: [
    { id: "a1b2c3", slug: "the-first-slice", project: "mvp", gateCount: 2 },
    { id: "c4d5e6", slug: "unprojected", project: undefined, gateCount: 0 },
  ],
  decide: [
    {
      project: "mvp",
      destination: "Ship bearing. Track work too large for one session.",
      fogCount: 3,
      tickets: [{ id: "b1c2d3", slug: "a-design-question", project: "mvp", gateCount: 1 }],
    },
  ],
  triageCount: 7,
  fogbound: ["second"],
};

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

describe("renderList", () => {
  it("leads with type, project, and readiness, then the id before the title", () => {
    const text = renderList(TICKETS, plainStyle);
    expect(text).toContain("build   mvp  ready    t4frt1  the first slice");
    expect(text).toContain("design  mvp  blocked  2z1qew  skill installation mechanics");
    expect(text).toContain("build   -    ready    a1b2c3  unprojected");
  });

  it("pads every column to its widest value so the titles line up", () => {
    const rows = renderList(TICKETS, plainStyle)
      .split("\n")
      .filter((line) => !line.startsWith(" "));
    const titleStarts = rows.map((row) => row.indexOf(row.trimEnd().split("  ").at(-1) as string));
    expect(new Set(titleStarts).size).toBe(1);
  });

  it("shows named blockers and both blocking closures where present", () => {
    const text = renderList(TICKETS, plainStyle);
    expect(text).toContain("blockers: kwjvxc");
    expect(text).toContain("blocked by: kwjvxc");
    expect(text).toContain("unblocks: 2z1qew");
    expect(text).not.toContain("blockers: \n");
    expect(text).not.toContain("blocked by: \n");
    expect(text).not.toContain("unblocks: \n");
  });

  it("hangs a blocker line under the title column", () => {
    const lines = renderList(TICKETS, plainStyle).split("\n");
    const row = lines.findIndex((line) => line.includes("skill installation mechanics"));
    const detail = lines[row + 1] as string;
    expect(detail.search(/\S/)).toBe((lines[row] as string).indexOf("skill installation mechanics"));
  });

  it("renders an empty list as an empty string", () => {
    expect(renderList([], plainStyle)).toBe("");
  });
});

describe("colour", () => {
  it("paints an id the same colour everywhere it appears", () => {
    const text = renderList(TICKETS, ansiStyle);
    const painted = new RegExp(`${ESC}\\[(\\d+)m2z1qew`).exec(text)?.[1];

    expect(painted).toBeDefined();
    // Once as its own row's id, once inside the first ticket's unblocks list.
    expect(text.split(`${ESC}[${painted as string}m2z1qew`)).toHaveLength(3);
  });

  it.each([
    ["31", "red, which means error"],
    ["32", "green, which means ready"],
    ["33", "yellow, which means blocked"],
  ])("never paints an id %s — %s", (code) => {
    const ids = TICKETS.map((ticket) => ansiStyle.id(ticket.id));
    expect(ids.some((id) => id.startsWith(`${ESC}[${code}m`))).toBe(false);
  });

  it("emits no escape sequence at all under the plain style", () => {
    expect(renderList(TICKETS, plainStyle)).not.toContain(ESC);
    expect(renderFrontier(FRONTIER, plainStyle)).not.toContain(ESC);
    expect(renderShow(TICKET_SHOW, plainStyle)).not.toContain(ESC);
  });
});

describe("renderFog", () => {
  it("groups each map's patches under its project", () => {
    expect(renderFog(FOG_REPORTS, plainStyle)).toBe("mvp\n  Reader depth\n\nsecond");
  });

  it("prints a map with no patches as its bare project", () => {
    expect(renderFog([FOG_REPORTS[1] as FogReport], plainStyle)).toBe("second");
  });

  it("renders an empty report as an empty string", () => {
    expect(renderFog([], plainStyle)).toBe("");
  });
});

describe("renderFrontier", () => {
  it("prints fogbound maps above BUILD, DECIDE, and TRIAGE in that order", () => {
    expect(renderFrontier(FRONTIER, plainStyle)).toBe(
      "second is fogbound: fog left, no open design tickets\n" +
        "BUILD\n" +
        "  a1b2c3  the first slice  mvp\n" +
        "  c4d5e6  unprojected\n" +
        "DECIDE\n" +
        "  mvp  3 fog\n" +
        "    b1c2d3  a design question\n" +
        "TRIAGE\n" +
        "  7",
    );
  });

  it("heads a decide group with its project and fog count, never its destination", () => {
    const text = renderFrontier(FRONTIER, plainStyle);
    expect(text).not.toContain("Ship bearing");
    expect(text).toContain("  mvp  3 fog");
  });

  it("prints an empty build and decide with the fogbound line still above them", () => {
    expect(renderFrontier({ build: [], decide: [], triageCount: 0, fogbound: ["mvp"] }, plainStyle)).toBe(
      "mvp is fogbound: fog left, no open design tickets\nBUILD\nDECIDE\nTRIAGE\n  0",
    );
  });

  it("renders the sections even when every section is empty", () => {
    expect(renderFrontier({ build: [], decide: [], triageCount: 0, fogbound: [] }, plainStyle)).toBe(
      "BUILD\nDECIDE\nTRIAGE\n  0",
    );
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

  it("round-trips a show item through the same value serializer", () => {
    expect(JSON.parse(renderJson(TICKET_SHOW))).toEqual(TICKET_SHOW);
  });
});

describe("renderRemovalError", () => {
  it.each([
    ["no-match", "zzzz", [], 'no item matches id prefix "zzzz"'],
    ["ambiguous", "a", ["a1b2c3", "a2b3c4"], 'ambiguous id prefix "a": a1b2c3, a2b3c4'],
    ["backlog-item", "c1d2e3", [], "cannot close backlog item c1d2e3 with bearing close; use bearing rm"],
  ] as const)("renders %s", (reason, target, candidates, expected) => {
    expect(renderRemovalError(new RemovalError({ reason, target, candidates }))).toBe(expected);
  });
});

describe("renderShow", () => {
  it("renders a ticket's frontmatter fields and body", () => {
    expect(renderShow(TICKET_SHOW, plainStyle)).toBe(
      "type: design\nproject: mvp\nblockers: kwjvxc\n\n# The first slice\n\nBody.",
    );
  });

  it("renders a backlog item's body without frontmatter fields", () => {
    expect(renderShow(BACKLOG_SHOW, plainStyle)).toBe("# A captured idea\n\nProse.");
  });
});
