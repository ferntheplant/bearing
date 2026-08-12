import type {
  BacklogItem,
  CheckResult,
  CreationApplyResult,
  DesignClosePlan,
  FogReport,
  Frontier,
  IntegrityFinding,
  ListedTicket,
  RemovalApplyResult,
  RemovalError,
  SetupOutcome,
  ShowItem,
  TicketCreationError,
} from "@bearing/core";

const titleFromSlug = (slug: string): string => slug.replaceAll("-", " ");

export const renderList = (tickets: readonly ListedTicket[]): string => tickets.map(renderListedTicket).join("\n");

export const renderFrontier = (frontier: Frontier): string => {
  const lines: string[] = [];
  for (const project of frontier.fogbound) {
    lines.push(`${project} is fogbound: fog left, no open design tickets`);
  }
  lines.push("BUILD");
  for (const ticket of frontier.build) {
    lines.push(`${ticket.id}  ${titleFromSlug(ticket.slug)}  ${ticket.project ?? "-"}`);
  }
  lines.push("DECIDE");
  for (const group of frontier.decide) {
    lines.push(`${group.destination} (${group.project}, ${group.fogCount} fog)`);
    for (const ticket of group.tickets) {
      lines.push(`  ${ticket.id}  ${titleFromSlug(ticket.slug)}`);
    }
  }
  lines.push("TRIAGE");
  lines.push(String(frontier.triageCount));
  return lines.join("\n");
};

export const renderBacklogList = (items: readonly BacklogItem[]): string =>
  items.map((item) => `${item.id}  ${titleFromSlug(item.slug)}`).join("\n");

export const renderFog = (maps: readonly FogReport[]): string =>
  maps
    .map((map) =>
      map.patches.length === 0
        ? map.project
        : `${map.project}\n${map.patches.map((patch) => `  ${patch.heading}`).join("\n")}`,
    )
    .join("\n\n");

export const renderCreation = (result: CreationApplyResult): string => `wrote ${result.path}`;

export const renderTicketCreationError = (error: TicketCreationError): string => {
  const projects = error.projects.join(", ") || "none";
  switch (error.reason) {
    case "design-no-project":
      return `cannot create a design ticket without --project; maps: ${projects}`;
    case "project-missing":
      return `no map for project "${error.project}"; maps: ${projects}`;
  }
};

export const renderRemoval = (result: RemovalApplyResult): string => {
  const lines = [`deleted ${result.removed}`];
  for (const path of result.rewrote) {
    lines.push(`stripped ${result.id} from ${path}`);
  }
  return lines.join("\n");
};

export const renderDesignClose = (plan: DesignClosePlan): string => {
  const lines = [
    "DESIGN TICKET",
    plan.ticket.source.trimEnd(),
    "",
    "TRAIL ROW",
    plan.trail.row.source,
    "",
    `WOULD DELETE ${plan.ticket.path}`,
  ];
  for (const ticket of plan.unblocks) {
    lines.push(`WOULD UNBLOCK ${ticket.id} ${ticket.path}`);
  }
  lines.push("", `Re-run with: bearing close ${plan.ticket.id} --confirm`);
  return lines.join("\n");
};

export const renderRemovalError = (error: RemovalError): string => {
  switch (error.reason) {
    case "no-match":
      return `no item matches id prefix "${error.prefix}"`;
    case "ambiguous":
      return `ambiguous id prefix "${error.prefix}": ${error.candidates.join(", ")}`;
    case "backlog-item":
      return `cannot close backlog item ${error.prefix} with bearing close; use bearing rm`;
    case "design-no-project":
      return `cannot close design ticket ${error.prefix}: it has no project`;
    case "project-missing":
      return `cannot close design ticket ${error.prefix}: no map carries project ${error.project}`;
    case "trail-row-missing":
      return `cannot close design ticket ${error.prefix}: project ${error.project} has no trail row for it`;
    case "trail-outcome-empty":
      return `cannot close design ticket ${error.prefix}: its trail row in project ${error.project} has an empty outcome`;
  }
};

export const renderCheck = (result: CheckResult): string => {
  if (result.findings.length === 0) {
    return "tracker is consistent";
  }
  return result.findings.map(renderFinding).join("\n");
};

const renderFinding = (finding: IntegrityFinding): string => {
  const prefix = finding.severity === "error" ? "error" : "warning";
  switch (finding.kind) {
    case "parse":
      return `${prefix}: ${finding.path}: ${finding.detail}`;
    case "unknown-type":
      return `${prefix}: ${finding.path}: type must be design or build`;
    case "blocker-missing":
      return `${prefix}: ${finding.path}: ticket ${finding.owner} names blocker ${finding.blocker}, which does not exist`;
    case "project-missing":
      return `${prefix}: ${finding.path}: ticket ${finding.owner} names project ${finding.project}, which no map carries`;
    case "design-no-project":
      return `${prefix}: ${finding.path}: design ticket ${finding.owner} has no project`;
    case "duplicate-id":
      return `${prefix}: id ${finding.id} is shared by ${finding.paths.join(", ")}`;
    case "trail-row-open-ticket":
      return `${prefix}: ${finding.path}: trail row names ticket ${finding.id}, which still exists\n        run: bearing close ${finding.id}`;
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
  const title = titleFromSlug(ticket.slug);
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
