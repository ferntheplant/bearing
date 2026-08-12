import type {
  BacklogItem,
  CheckReport,
  CheckResult,
  CreationApplyResult,
  DesignClosePlan,
  FogReport,
  Frontier,
  IntegrityFinding,
  ListedTicket,
  RemovalApplyResult,
  RemovalError,
  RetitleApplyResult,
  RetitleError,
  SetupOutcome,
  ShowItem,
  TicketCreationError,
  TriageApplyResult,
  TriageError,
} from "@bearing/core";

import { cell, type Style, widestOf } from "./style.ts";

const titleFromSlug = (slug: string): string => slug.replaceAll("-", " ");

/** Renders a list of ids inline, each keeping its own colour. */
const idList = (ids: readonly string[], style: Style): string => ids.map((id) => style.id(id)).join(", ");

export const renderList = (tickets: readonly ListedTicket[], style: Style): string => {
  const types = widestOf(tickets.map((ticket) => ticket.type));
  const projects = widestOf(tickets.map((ticket) => ticket.project ?? "-"));
  const readiness = widestOf(tickets.map((ticket) => (ticket.ready ? "ready" : "blocked")));
  const ids = widestOf(tickets.map((ticket) => ticket.id));
  // Sub-lines hang under the title, so their indent is every preceding column
  // plus the two spaces separating each one.
  const indent = " ".repeat(types + projects + readiness + ids + 8);

  const lines: string[] = [];
  for (const ticket of tickets) {
    const status = ticket.ready ? "ready" : "blocked";
    lines.push(
      [
        cell(ticket.type, types, style.muted),
        cell(ticket.project ?? "-", projects, style.muted),
        cell(status, readiness, ticket.ready ? style.good : style.caution),
        cell(ticket.id, ids, style.id),
        titleFromSlug(ticket.slug),
      ].join("  "),
    );
    const detail = (label: string, values: readonly string[]) => {
      if (values.length > 0) {
        lines.push(`${indent}${style.muted(label)} ${idList(values, style)}`);
      }
    };
    detail("blockers:", ticket.blockers);
    detail("blocked by:", ticket.blockedBy);
    detail("unblocks:", ticket.unblocks);
  }
  return lines.join("\n");
};

export const renderFrontier = (frontier: Frontier, style: Style): string => {
  const lines: string[] = [];
  for (const project of frontier.fogbound) {
    lines.push(style.caution(`${project} is fogbound: fog left, no open design tickets`));
  }

  lines.push(style.heading("BUILD"));
  const buildIds = widestOf(frontier.build.map((ticket) => ticket.id));
  for (const ticket of frontier.build) {
    const project = ticket.project === undefined ? "" : `  ${style.muted(ticket.project)}`;
    lines.push(`  ${cell(ticket.id, buildIds, style.id)}  ${titleFromSlug(ticket.slug)}${project}`);
  }

  lines.push(style.heading("DECIDE"));
  for (const group of frontier.decide) {
    // The destination is a paragraph and belongs on the map, not in a heading
    // an agent reads every turn (ADR 0042). The project names the map; the fog
    // count says how much of it is still uncharted.
    lines.push(`  ${style.muted(group.project)}  ${style.muted(`${group.fogCount} fog`)}`);
    const decideIds = widestOf(group.tickets.map((ticket) => ticket.id));
    for (const ticket of group.tickets) {
      lines.push(`    ${cell(ticket.id, decideIds, style.id)}  ${titleFromSlug(ticket.slug)}`);
    }
  }

  lines.push(style.heading("TRIAGE"));
  lines.push(`  ${frontier.triageCount}`);
  return lines.join("\n");
};

export const renderBacklogList = (items: readonly BacklogItem[], style: Style): string => {
  const ids = widestOf(items.map((item) => item.id));
  return items.map((item) => `${cell(item.id, ids, style.id)}  ${titleFromSlug(item.slug)}`).join("\n");
};

export const renderFog = (maps: readonly FogReport[], style: Style): string =>
  maps
    .map((map) =>
      map.patches.length === 0
        ? style.heading(map.project)
        : `${style.heading(map.project)}\n${map.patches.map((patch) => `  ${patch.heading}`).join("\n")}`,
    )
    .join("\n\n");

export const renderCreation = (result: CreationApplyResult, style: Style): string =>
  `wrote ${style.muted(result.path)}`;

export const renderTicketCreationError = (error: TicketCreationError): string => {
  const projects = error.projects.join(", ") || "none";
  switch (error.reason) {
    case "design-no-project":
      return `cannot create a design ticket without --project; maps: ${projects}`;
    case "project-missing":
      return `no map for project "${error.project}"; maps: ${projects}`;
  }
};

export const renderRemoval = (result: RemovalApplyResult, style: Style): string => {
  const lines = [`deleted ${style.muted(result.removed)}`];
  for (const path of result.rewrote) {
    lines.push(`stripped ${style.id(result.id)} from ${style.muted(path)}`);
  }
  return lines.join("\n");
};

export const renderDesignClose = (plan: DesignClosePlan, style: Style): string => {
  const lines = [
    style.heading("DESIGN TICKET"),
    plan.ticket.source.trimEnd(),
    "",
    style.heading("TRAIL ROW"),
    plan.trail.row.source,
    "",
    `${style.heading("WOULD DELETE")} ${style.muted(plan.ticket.path)}`,
  ];
  for (const ticket of plan.unblocks) {
    lines.push(`${style.heading("WOULD UNBLOCK")} ${style.id(ticket.id)} ${style.muted(ticket.path)}`);
  }
  lines.push("", `Re-run with: ${style.command(`bearing close ${plan.ticket.id} --confirm`)}`);
  return lines.join("\n");
};

const renderNoMatch = (prefix: string): string => `no item matches id prefix "${prefix}"`;

export const renderRemovalError = (error: RemovalError): string => {
  switch (error.reason) {
    case "no-match":
      return renderNoMatch(error.prefix);
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

export const renderRetitle = (result: RetitleApplyResult, style: Style): string =>
  result.changed
    ? `renamed ${style.muted(result.from)} to ${style.muted(result.to)}`
    : `unchanged ${style.muted(result.from)}`;

export const renderRetitleError = (error: RetitleError): string => {
  switch (error.reason) {
    case "no-match":
      return renderNoMatch(error.prefix);
    case "ambiguous":
      return `ambiguous id prefix "${error.prefix}": ${error.candidates.join(", ")}`;
    case "backlog-item":
      return `cannot retitle backlog item ${error.prefix}; bearing retitle renames tickets`;
  }
};

export const renderTriage = (result: TriageApplyResult, style: Style): string =>
  result.verdict === "drop"
    ? `deleted ${style.muted(result.from)}`
    : `promoted ${style.id(result.id)} to ${style.muted(result.to)}`;

export const renderTriageError = (error: TriageError): string => {
  switch (error.reason) {
    case "no-match":
      return renderNoMatch(error.prefix);
    case "ambiguous":
      return `ambiguous id prefix "${error.prefix}": ${error.candidates.join(", ")}`;
    case "ticket-item":
      return `cannot triage ${error.prefix}: it is already a ticket`;
    case "project-missing":
      return `no map for project "${error.project}"; maps: ${error.projects?.join(", ") || "none"}`;
  }
};

/**
 * What each check is called when a person reads it. The domain names checks with
 * an enum and never a sentence (ADR 0019), so the wording lives here.
 */
const CHECK_LABELS: Record<CheckReport["name"], string> = {
  parse: "document parsing",
  "duplicate-id": "id collisions",
  "unknown-type": "ticket types",
  "design-no-project": "design ticket projects",
  "project-missing": "project references",
  "blocker-missing": "blocker references",
  "trail-row-open-ticket": "trail rows",
};

export const renderCheck = (result: CheckResult, style: Style): string => {
  const lines: string[] = [];
  let errors = 0;
  let warnings = 0;

  for (const check of result.checks) {
    const failed = check.findings.length > 0;
    const mark = !failed ? style.good("ok  ") : check.severity === "error" ? style.bad("fail") : style.caution("warn");
    lines.push(`${mark}  ${failed ? CHECK_LABELS[check.name] : style.muted(CHECK_LABELS[check.name])}`);
    for (const finding of check.findings) {
      for (const line of renderFinding(finding, style).split("\n")) {
        lines.push(`${" ".repeat(6)}${line}`);
      }
    }
    if (failed) {
      if (check.severity === "error") {
        errors += check.findings.length;
      } else {
        warnings += check.findings.length;
      }
    }
  }

  const counts = [`${result.checks.length} checks`];
  if (errors > 0) {
    counts.push(`${errors} ${errors === 1 ? "error" : "errors"}`);
  }
  if (warnings > 0) {
    counts.push(`${warnings} ${warnings === 1 ? "warning" : "warnings"}`);
  }
  const summary =
    errors === 0 && warnings === 0 ? `${result.checks.length} checks, tracker is consistent` : counts.join(", ");
  lines.push("", errors > 0 ? style.bad(summary) : warnings > 0 ? style.caution(summary) : style.good(summary));
  return lines.join("\n");
};

const renderFinding = (finding: IntegrityFinding, style: Style): string => {
  switch (finding.kind) {
    case "parse":
      return `${style.muted(finding.path)}: ${finding.detail}`;
    case "unknown-type":
      return `${style.muted(finding.path)}: type must be design or build`;
    case "blocker-missing":
      return `${style.id(finding.owner)} names blocker ${style.id(finding.blocker)}, which does not exist`;
    case "project-missing":
      return `${style.id(finding.owner)} names project ${finding.project}, which no map carries`;
    case "design-no-project":
      return `${style.id(finding.owner)} has no project`;
    case "duplicate-id":
      return `${style.id(finding.id)} is shared by ${finding.paths.map((path) => style.muted(path)).join(", ")}`;
    case "trail-row-open-ticket":
      return `${style.muted(finding.path)}: trail row names ticket ${style.id(finding.id)}, which still exists\n  run: ${style.command(`bearing close ${finding.id}`)}`;
  }
};

export const renderJson = (value: object): string => JSON.stringify(value, null, 2);

export const renderSetupOutcome = (outcome: SetupOutcome, style: Style): string => {
  switch (outcome.tag) {
    case "installed": {
      const prefix = outcome.trackerCreated ? "created .bearing and installed" : "installed";
      return `${prefix} the bearing-wayfinder skill at ${style.muted(outcome.home.label)}`;
    }
    case "updated":
      return `updated the bearing-wayfinder skill at ${style.muted(outcome.home.label)}`;
    case "skipped":
      return `left the bearing-wayfinder skill at ${style.muted(outcome.home.label)} untouched (locally modified)`;
  }
};

export const renderShow = (item: ShowItem, style: Style): string => {
  if (item.kind === "ticket") {
    const lines = [`${style.muted("type:")} ${item.type}`];
    if (item.project !== undefined) {
      lines.push(`${style.muted("project:")} ${item.project}`);
    }
    if (item.blockers.length > 0) {
      lines.push(`${style.muted("blockers:")} ${idList(item.blockers, style)}`);
    }
    return `${lines.join("\n")}\n\n${item.body}`;
  }
  return item.body;
};
