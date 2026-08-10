import { describe, expect, it } from "vite-plus/test";

import { sha256Hex } from "#src/sha256.ts";

describe("sha256Hex", () => {
  it("matches the standard single-block vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches the standard multi-block vector", () => {
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("changes when any byte changes", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
    expect(sha256Hex("ab")).not.toBe(sha256Hex("ba"));
  });
});
