import type { Ticket } from "@bearing/core";

export const renderText = (tickets: readonly Ticket[]): string => tickets.map(renderTicket).join("\n");

export const renderJson = (tickets: readonly Ticket[]): string => JSON.stringify(tickets, null, 2);

const renderTicket = (ticket: Ticket): string => {
  const project = ticket.project ?? "-";
  const title = ticket.slug.replaceAll("-", " ");
  const lines = [`${ticket.id}  ${title}  ${ticket.type}  ${project}`];
  if (ticket.blockers.length > 0) {
    lines.push(`        blockers: [${ticket.blockers.join(", ")}]`);
  }
  return lines.join("\n");
};
