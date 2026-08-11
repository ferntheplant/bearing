import type { SetupOutcome, ShowItem, Ticket } from "@bearing/core";

export const renderText = (tickets: readonly Ticket[]): string => tickets.map(renderTicket).join("\n");

export const renderJson = (tickets: readonly Ticket[]): string => JSON.stringify(tickets, null, 2);

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
  const title = item.slug.replaceAll("-", " ");
  if (item.kind === "ticket") {
    const lines = [`${item.id}  ${title}  ${item.type}  ${item.project ?? "-"}`];
    if (item.blockers.length > 0) {
      lines.push(`        blockers: [${item.blockers.join(", ")}]`);
    }
    return `${lines.join("\n")}\n\n${item.body}`;
  }
  return `${item.id}  ${title}\n\n${item.body}`;
};

export const renderShowFull = (item: ShowItem): string => item.source;

const showValues = (item: ShowItem): Record<string, unknown> =>
  item.kind === "ticket"
    ? {
        kind: item.kind,
        id: item.id,
        slug: item.slug,
        type: item.type,
        project: item.project,
        blockers: item.blockers,
        body: item.body,
      }
    : {
        kind: item.kind,
        id: item.id,
        slug: item.slug,
        body: item.body,
      };

export const renderShowJson = (item: ShowItem): string => JSON.stringify(showValues(item), null, 2);
