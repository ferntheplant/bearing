import type { Ticket } from "@bearing/core";
import { describe, expect, it } from "vite-plus/test";

import { renderJson, renderText } from "#src/render.ts";

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
