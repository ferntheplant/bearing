import type { BacklogItem, CaptureApplyResult, FogReport, SetupOutcome, ShowItem, Ticket } from "@bearing/core";

export const renderText = (tickets: readonly Ticket[]): string => tickets.map(renderTicket).join("\n");

export const renderBacklogList = (items: readonly BacklogItem[]): string =>
  items.map((item) => `${item.id}  ${item.slug.replaceAll("-", " ")}`).join("\n");

export const renderFog = (maps: readonly FogReport[]): string =>
  maps
    .map((map) =>
      map.patches.length === 0
        ? map.project
        : `${map.project}\n${map.patches.map((patch) => `  ${patch.heading}`).join("\n")}`,
    )
    .join("\n\n");

export const renderCapture = (result: CaptureApplyResult): string => `wrote ${result.path}`;

export const renderJson = (value: object): string => JSON.stringify(value, null, 2);

export const renderSetupOutcome = (outcome: SetupOutcome): string => {
  switch (outcome.tag) {
    case "installed": {
      const prefix = outcome.trackerCreated ? "created .bearing and installed" : "installed";
      return `${prefix} the bearing-wayfinder skill at ${outcome.home.label}`;
    }
    case "updated":
      return `updated the bearing-wayfinder skill at ${outcome.home.label}`;
    case "skipped":
      return `left the bearing-wayfinder skill at ${outcome.home.label} untouched (locally modified)`;
  }
};

const renderTicket = (ticket: Ticket): string => {
  const project = ticket.project ?? "-";
  const title = ticket.slug.replaceAll("-", " ");
  const lines = [`${ticket.id}  ${title}  ${ticket.type}  ${project}`];
  if (ticket.blockers.length > 0) {
    lines.push(`        blockers: [${ticket.blockers.join(", ")}]`);
  }
  return lines.join("\n");
};

export const renderShow = (item: ShowItem): string => {
  if (item.kind === "ticket") {
    const lines = [`type: ${item.type}`];
    if (item.project !== undefined) {
      lines.push(`project: ${item.project}`);
    }
    if (item.blockers.length > 0) {
      lines.push(`blockers: [${item.blockers.join(", ")}]`);
    }
    return `${lines.join("\n")}\n\n${item.body}`;
  }
  return item.body;
};
