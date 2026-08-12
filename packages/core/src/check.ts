import type { FileSystem, Path } from "effect";
import { Effect, Result } from "effect";

import type {
  MalformedTrackerError,
  MapDocument,
  Ticket,
  TrackerNotFoundError,
  TrackerObservation,
  TrackerReadError,
} from "./acquisition.ts";
import { acquireTracker, discoverTracker } from "./acquisition.ts";

const UNKNOWN_TYPE_MESSAGE = "type must be design or build";

export type IntegritySeverity = "error" | "warning";

export type IntegrityFinding =
  | {
      readonly severity: "error";
      readonly kind: "parse";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly severity: "error";
      readonly kind: "unknown-type";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly severity: "error";
      readonly kind: "blocker-missing";
      readonly path: string;
      readonly owner: string;
      readonly blocker: string;
      readonly message: string;
    }
  | {
      readonly severity: "error";
      readonly kind: "project-missing";
      readonly path: string;
      readonly owner: string;
      readonly project: string;
      readonly message: string;
    }
  | {
      readonly severity: "error";
      readonly kind: "design-no-project";
      readonly path: string;
      readonly owner: string;
      readonly message: string;
    }
  | {
      readonly severity: "error";
      readonly kind: "duplicate-id";
      readonly id: string;
      readonly paths: readonly string[];
      readonly message: string;
    }
  | {
      readonly severity: "warning";
      readonly kind: "trail-row-open-ticket";
      readonly path: string;
      readonly id: string;
      readonly fix: string;
      readonly message: string;
    };

export interface CheckResult {
  readonly findings: readonly IntegrityFinding[];
}

export const analyzeIntegrity = (observation: TrackerObservation): CheckResult => {
  const findings: IntegrityFinding[] = [];

  for (const diagnostic of observation.diagnostics) {
    findings.push({
      severity: "error",
      kind: diagnostic.message === UNKNOWN_TYPE_MESSAGE ? "unknown-type" : "parse",
      path: diagnostic.path,
      message: `${diagnostic.path}: ${diagnostic.message}`,
    });
  }

  const itemIds = new Map<string, string[]>();
  const tickets: { path: string; ticket: Ticket }[] = [];
  const maps: { path: string; map: MapDocument }[] = [];

  const addId = (id: string, path: string): void => {
    const existing = itemIds.get(id);
    if (existing === undefined) {
      itemIds.set(id, [path]);
    } else {
      existing.push(path);
    }
  };

  for (const document of observation.backlog) {
    if (Result.isSuccess(document.parsed)) {
      addId(document.parsed.success.id, document.path);
    }
  }
  for (const document of observation.tickets) {
    if (Result.isSuccess(document.parsed)) {
      addId(document.parsed.success.id, document.path);
      tickets.push({ path: document.path, ticket: document.parsed.success });
    }
  }
  for (const document of observation.maps) {
    if (Result.isSuccess(document.parsed)) {
      maps.push({ path: document.path, map: document.parsed.success });
    }
  }

  for (const [id, paths] of itemIds) {
    if (paths.length > 1) {
      findings.push({
        severity: "error",
        kind: "duplicate-id",
        id,
        paths,
        message: `id ${id} is shared by ${paths.join(", ")}`,
      });
    }
  }

  const projects = new Set(maps.map(({ map }) => map.project));
  const ticketIds = new Set(tickets.map(({ ticket }) => ticket.id));

  for (const { path, ticket } of tickets) {
    if (ticket.project !== undefined && !projects.has(ticket.project)) {
      findings.push({
        severity: "error",
        kind: "project-missing",
        path,
        owner: ticket.id,
        project: ticket.project,
        message: `${path}: ticket ${ticket.id} names project ${ticket.project}, which no map carries`,
      });
    }
    if (ticket.type === "design" && ticket.project === undefined) {
      findings.push({
        severity: "error",
        kind: "design-no-project",
        path,
        owner: ticket.id,
        message: `${path}: design ticket ${ticket.id} has no project`,
      });
    }
    for (const blocker of ticket.blockers) {
      if (!itemIds.has(blocker)) {
        findings.push({
          severity: "error",
          kind: "blocker-missing",
          path,
          owner: ticket.id,
          blocker,
          message: `${path}: ticket ${ticket.id} names blocker ${blocker}, which does not exist`,
        });
      }
    }
  }

  for (const { path, map } of maps) {
    for (const row of map.trail) {
      if (ticketIds.has(row.id)) {
        findings.push({
          severity: "warning",
          kind: "trail-row-open-ticket",
          path,
          id: row.id,
          fix: `bearing close ${row.id}`,
          message: `${path}: trail row names ticket ${row.id}, which still exists`,
        });
      }
    }
  }

  return { findings };
};

export const checkTracker = (
  startDirectory: string,
): Effect.Effect<
  CheckResult,
  TrackerReadError | TrackerNotFoundError | MalformedTrackerError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const tracker = yield* discoverTracker(startDirectory);
    const observation = yield* acquireTracker(tracker);
    return analyzeIntegrity(observation);
  });
