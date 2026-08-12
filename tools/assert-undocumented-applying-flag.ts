import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APPLYING_FLAG = "--confirm";

const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const SHIPPED_SKILL_ROOT = resolve(REPOSITORY_ROOT, "skills/bearing-wayfinder");
const BUILT_BINARY = resolve(REPOSITORY_ROOT, "apps/cli/dist/cli.mjs");

const reason =
  "ADR 0016 keeps the applying flag out of shipped guidance so a design close must reveal it only after the caller reads the dry-run trail row";

const assertAbsent = (content: string, source: string): void => {
  const index = content.indexOf(APPLYING_FLAG);
  if (index === -1) return;
  const line = content.slice(0, index).split("\n").length;
  throw new Error(`${source}:${line} names ${APPLYING_FLAG}; ${reason}`);
};

const scanSkillTree = async (skillRoot: string, directory = skillRoot): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await scanSkillTree(skillRoot, path);
    } else if (entry.isFile()) {
      assertAbsent(await readFile(path, "utf8"), `skills/bearing-wayfinder/${relative(skillRoot, path)}`);
    }
  }
};

const subcommandsFrom = (help: string): readonly string[] => {
  const lines = help.split("\n");
  const start = lines.indexOf("SUBCOMMANDS");
  if (start === -1) return [];
  const names: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^  (\S+)\s{2,}/.exec(line);
    if (match?.[1] !== undefined) {
      names.push(match[1]);
    } else if (line.trim() !== "") {
      break;
    }
  }
  return names;
};

const generatedHelp = async (binary: string, commandPath: readonly string[]): Promise<string> => {
  const process = Bun.spawn([binary, ...commandPath, "--help"], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    const command = ["bearing", ...commandPath, "--help"].join(" ");
    throw new Error(`${command} exited ${exitCode} while checking generated help: ${stderr.trim()}`);
  }
  return stdout;
};

const scanGeneratedHelp = async (binary: string): Promise<void> => {
  const pending: string[][] = [[]];
  while (pending.length > 0) {
    const commandPath = pending.shift();
    if (commandPath === undefined) break;
    const help = await generatedHelp(binary, commandPath);
    const command = ["bearing", ...commandPath, "--help"].join(" ");
    assertAbsent(help, command);
    const subcommands = subcommandsFrom(help);
    if (commandPath.length === 0 && subcommands.length === 0) {
      throw new Error(
        "bearing --help exposed no subcommands, so the applying-flag check could not inspect every command",
      );
    }
    pending.push(...subcommands.map((name) => [...commandPath, name]));
  }
};

export const assertUndocumentedApplyingFlag = async (skillRoot: string, binary: string): Promise<void> => {
  await scanSkillTree(skillRoot);
  await scanGeneratedHelp(binary);
};

if (import.meta.main) {
  await assertUndocumentedApplyingFlag(SHIPPED_SKILL_ROOT, BUILT_BINARY);
}
