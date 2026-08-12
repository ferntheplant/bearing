import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, beforeAll, expect, it } from "vite-plus/test";

import {
  APPLYING_FLAG,
  assertUndocumentedApplyingFlag,
  SHIPPED_SKILL_ROOT,
} from "./assert-undocumented-applying-flag.ts";

let fixtureRoot: string;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "bearing-undocumented-flag-"));
});

afterAll(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

it("rejects the full shipped skill tree with an explanatory error when any file names the applying flag", async () => {
  const skillRoot = join(fixtureRoot, "bearing-wayfinder");
  await cp(SHIPPED_SKILL_ROOT, skillRoot, { recursive: true });
  const violation = join(skillRoot, "references", "closing.md");
  await mkdir(dirname(violation), { recursive: true });
  await writeFile(violation, `Apply a design close with ${APPLYING_FLAG}.\n`);

  await expect(assertUndocumentedApplyingFlag(skillRoot, join(fixtureRoot, "missing-binary"))).rejects.toThrow(
    /skills\/bearing-wayfinder\/references\/closing\.md:1 names .*ADR 0016.*dry-run trail row/,
  );
});
