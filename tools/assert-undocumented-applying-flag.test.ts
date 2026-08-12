import { chmod, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, beforeAll, expect, it } from "vite-plus/test";

import {
  APPLYING_FLAG,
  assertUndocumentedApplyingFlag,
  BUILT_BINARY,
  SHIPPED_SKILL_ROOT,
} from "./assert-undocumented-applying-flag.ts";

let fixtureRoot: string;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "bearing-undocumented-flag-"));
});

afterAll(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

const copySkill = async (name: string): Promise<string> => {
  const skillRoot = join(fixtureRoot, name, "bearing-wayfinder");
  await cp(SHIPPED_SKILL_ROOT, skillRoot, { recursive: true });
  return skillRoot;
};

const writeHelpBinary = async (name: string, helpByArguments: Readonly<Record<string, string>>): Promise<string> => {
  const binary = join(fixtureRoot, name);
  await writeFile(
    binary,
    `#!/usr/bin/env bun
const help = ${JSON.stringify(helpByArguments)};
const output = help[Bun.argv.slice(2).join(" ")];
if (output === undefined) process.exit(1);
await Bun.write(Bun.stdout, output);
`,
  );
  await chmod(binary, 0o755);
  return binary;
};

it("accepts the clean skill tree and generated help from the built binary", async () => {
  await expect(assertUndocumentedApplyingFlag(SHIPPED_SKILL_ROOT, BUILT_BINARY)).resolves.toBeUndefined();
});

it("rejects the full shipped skill tree with an explanatory error when any file names the applying flag", async () => {
  const skillRoot = await copySkill("skill-violation");
  const violation = join(skillRoot, "references", "closing.md");
  await mkdir(dirname(violation), { recursive: true });
  await writeFile(violation, `Apply a design close with ${APPLYING_FLAG}.\n`);

  await expect(assertUndocumentedApplyingFlag(skillRoot, join(fixtureRoot, "missing-binary"))).rejects.toThrow(
    /skills\/bearing-wayfinder\/references\/closing\.md:1 names .*ADR 0016.*dry-run trail row/,
  );
});

it("rejects generated subcommand help with an explanatory error when it names the applying flag", async () => {
  const skillRoot = await copySkill("help-violation");
  const binary = await writeHelpBinary("bearing-with-flag", {
    "--help": "SUBCOMMANDS\n  close  Close a ticket\n",
    "close --help": `USAGE\n  bearing close <id> [${APPLYING_FLAG}]\n`,
  });

  await expect(assertUndocumentedApplyingFlag(skillRoot, binary)).rejects.toThrow(
    /bearing close --help:2 names .*ADR 0016.*dry-run trail row/,
  );
});
