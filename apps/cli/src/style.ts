/**
 * The colour seam. Every renderer takes a `Style` and asks it to paint a role —
 * an id, a status, a heading — rather than naming a colour, so the palette is
 * decided in one place and `plainStyle` disables all of it by being identity.
 *
 * Bearing colourises human output and never `--json` output
 * (ADR 0041). Nothing here knows what a ticket is.
 */

export interface Style {
  /** A section heading: BUILD, DECIDE, TRIAGE. */
  readonly heading: (text: string) => string;
  /** An item id, coloured from the id itself so it is the same colour everywhere. */
  readonly id: (id: string) => string;
  /** Supporting detail that should recede: types, projects, blocker lists. */
  readonly muted: (text: string) => string;
  /** A ready ticket, a passing check. */
  readonly good: (text: string) => string;
  /** A blocked ticket, a warning finding, a fogbound map. */
  readonly caution: (text: string) => string;
  /** An error finding. */
  readonly bad: (text: string) => string;
  /** A command the reader is meant to copy and run. */
  readonly command: (text: string) => string;
}

const identity = (text: string): string => text;

/**
 * No colour at all. Used when `NO_COLOR` is set, when stdout is not a terminal,
 * and by every test that asserts on exact output.
 */
export const plainStyle: Style = {
  heading: identity,
  id: identity,
  muted: identity,
  good: identity,
  caution: identity,
  bad: identity,
  command: identity,
};

const paint = (code: string) => (text: string) => `\u001B[${code}m${text}\u001B[0m`;

/**
 * Six foreground colours for ids: the blues, magentas, and cyans, in normal and
 * bright. Red, green, and yellow are deliberately absent — they carry meaning
 * here (error, ready, blocked), and an id that happened to be green would read
 * as a status. An id keeps its colour across `ls`, `next`, and every blocker
 * list, which is what makes a listing scannable: the same handle looks the same
 * everywhere it appears.
 */
const ID_COLORS = ["34", "94", "35", "95", "36", "96"] as const;

const idColor = (id: string): string => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return ID_COLORS[hash % ID_COLORS.length] as string;
};

export const ansiStyle: Style = {
  heading: paint("1"),
  id: (id) => paint(idColor(id))(id),
  muted: paint("2"),
  good: paint("32"),
  caution: paint("33"),
  bad: paint("31"),
  command: paint("1"),
};

/**
 * Pads a cell to a column width, measuring the plain text and painting it
 * afterwards, so escape sequences never count toward the width.
 */
export const cell = (text: string, width: number, paintCell: (text: string) => string): string =>
  paintCell(text) + " ".repeat(Math.max(0, width - text.length));

export const widestOf = (values: readonly string[]): number =>
  values.reduce((widest, value) => Math.max(widest, value.length), 0);
