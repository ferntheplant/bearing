import type { SetupOutcome, Ticket } from "@bearing/core";

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
