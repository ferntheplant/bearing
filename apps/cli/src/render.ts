import type { Ticket } from "@bearing/core";

export const renderText = (tickets: readonly Ticket[]): string => tickets.map(renderTicket).join("\n");

export const renderJson = (tickets: readonly Ticket[]): string => JSON.stringify(tickets, null, 2);

const renderTicket = (ticket: Ticket): string => {
  const project = ticket.project ?? "-";
  const lines = [`${ticket.id}  ${ticket.title}  ${ticket.type}  ${project}`];
  if (ticket.blockers.length > 0 || ticket.clears.length > 0) {
    const metadata: string[] = [];
    if (ticket.blockers.length > 0) {
      metadata.push(`blockers: [${ticket.blockers.join(", ")}]`);
    }
    if (ticket.clears.length > 0) {
      metadata.push(`clears: [${ticket.clears.join(", ")}]`);
    }
    lines.push(`        ${metadata.join("  ")}`);
  }
  return lines.join("\n");
};
