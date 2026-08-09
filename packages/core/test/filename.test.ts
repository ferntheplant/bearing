import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { parseTicketFilename } from "#src/filename.ts";

describe("parseTicketFilename", () => {
  it("parses an id and a slug from a ticket filename", () => {
    expect(parseTicketFilename("t4frt1-the-first-slice-ls-over-a-real-tracker.md")).toEqual(
      Option.some({ id: "t4frt1", slug: "the-first-slice-ls-over-a-real-tracker" }),
    );
  });

  it("keeps the whole rest of the stem as the slug", () => {
    expect(parseTicketFilename("a1b2c3-a-b-c.md")).toEqual(Option.some({ id: "a1b2c3", slug: "a-b-c" }));
  });

  it("does not validate the id, leaving that to the integrity pass", () => {
    expect(parseTicketFilename("readme-not-a-ticket.md")).toEqual(Option.some({ id: "readme", slug: "not-a-ticket" }));
  });

  it("rejects a filename with no id-slug split", () => {
    expect(parseTicketFilename("readme.md")).toEqual(Option.none());
  });

  it("rejects a filename that is not markdown", () => {
    expect(parseTicketFilename(".DS_Store")).toEqual(Option.none());
  });
});
