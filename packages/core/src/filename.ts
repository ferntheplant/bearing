import { Option } from "effect";

export interface TicketName {
  readonly id: string;
  readonly slug: string;
}

export const parseTicketFilename = (basename: string): Option.Option<TicketName> => {
  if (!basename.endsWith(".md")) {
    return Option.none();
  }
  const stem = basename.slice(0, -3);
  const hyphen = stem.indexOf("-");
  if (hyphen <= 0 || hyphen === stem.length - 1) {
    return Option.none();
  }
  return Option.some({ id: stem.slice(0, hyphen), slug: stem.slice(hyphen + 1) });
};
