import type {
  BacklogItem,
  CaptureApplyResult,
  FogReport,
  Frontier,
  ListedTicket,
  RemovalApplyResult,
  RemovalError,
  SetupOutcome,
  ShowItem,
} from "@bearing/core";

export const renderList = (tickets: readonly ListedTicket[]): string => tickets.map(renderListedTicket).join("\n");

export const renderFrontier = (frontier: Frontier): string => {
  const lines: string[] = [];
  for (const project of frontier.fogbound) {
    lines.push(`${project} is fogbound: fog left, no open design tickets`);
  }
  lines.push("BUILD");
  for (const ticket of frontier.build) {
    lines.push(`${ticket.id}  ${ticket.slug.replaceAll("-", " ")}  ${ticket.project ?? "-"}`);
  }
  lines.push("DECIDE");
  for (const group of frontier.decide) {
    lines.push(`${group.destination} (${group.project}, ${group.fogCount} fog)`);
    for (const ticket of group.tickets) {
      lines.push(`  ${ticket.id}  ${ticket.slug.replaceAll("-", " ")}`);
    }
  }
  lines.push("TRIAGE");
  lines.push(String(frontier.triageCount));
  return lines.join("\n");
};

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

export const renderRemoval = (result: RemovalApplyResult): string => {
  const lines = [`deleted ${result.removed}`];
  for (const path of result.rewrote) {
    lines.push(`stripped ${result.id} from ${path}`);
  }
  return lines.join("\n");
};

export const renderRemovalError = (error: RemovalError): string => {
  switch (error.reason) {
    case "no-match":
      return `no item matches id prefix "${error.prefix}"`;
    case "ambiguous":
      return `ambiguous id prefix "${error.prefix}": ${error.candidates.join(", ")}`;
    case "design-ticket":
      return `cannot close design ticket ${error.prefix} with bearing close; a design ticket closes against its trail row`;
    case "backlog-item":
      return `cannot close backlog item ${error.prefix} with bearing close; use bearing rm`;
  }
};

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

const renderListedTicket = (ticket: ListedTicket): string => {
  const project = ticket.project ?? "-";
  const title = ticket.slug.replaceAll("-", " ");
  const readiness = ticket.ready ? "ready" : "blocked";
  const lines = [`${ticket.id}  ${title}  ${ticket.type}  ${project}  ${readiness}`];
  if (ticket.blockers.length > 0) {
    lines.push(`        blockers: [${ticket.blockers.join(", ")}]`);
  }
  if (ticket.blockedBy.length > 0) {
    lines.push(`        blocked by: [${ticket.blockedBy.join(", ")}]`);
  }
  if (ticket.unblocks.length > 0) {
    lines.push(`        unblocks: [${ticket.unblocks.join(", ")}]`);
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
