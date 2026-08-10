import { mkdir, mkdtemp, readFile, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { digestSkillTree, OWNERSHIP_MARKER_FILE, SKILL_DIRECTORY } from "@bearing/core";
import { describe, expect, it } from "vite-plus/test";

import { main } from "#src/cli.ts";
import type { AskDestination } from "#src/setup.ts";
import { packagedSkill } from "#src/skill.ts";

const capture = () => {
  let text = "";
  return {
    writer: {
      write: (chunk: string) => {
        text += chunk;
      },
    },
    read: () => text,
  };
};

const neverAsk: AskDestination = async () => {
  throw new Error("ask must not be called");
};

const init = async (cwd: string, ask: AskDestination = neverAsk) => {
  const stdout = capture();
  const stderr = capture();
  const exitCode = await main(["init"], stdout.writer, stderr.writer, cwd, ask);
  return { exitCode, stdout: stdout.read(), stderr: stderr.read() };
};

const wayfinder = (root: string, convention = ".agents") => join(root, convention, "skills", SKILL_DIRECTORY);

const markerPath = (root: string, convention = ".agents") => join(wayfinder(root, convention), OWNERSHIP_MARKER_FILE);

const readMarker = async (root: string, convention = ".agents") =>
  JSON.parse(await readFile(markerPath(root, convention), "utf8")) as { version: string; digest: string };

const packaged = () => {
  const skill = packagedSkill();
  return { ...skill, digest: digestSkillTree(skill.files) };
};

const assertDirectory = async (path: string) => {
  expect((await stat(path)).isDirectory()).toBe(true);
};

const assertFile = async (path: string, content?: string) => {
  expect((await stat(path)).isFile()).toBe(true);
  if (content !== undefined) {
    expect(await readFile(path, "utf8")).toBe(content);
  }
};

describe("bearing init", () => {
  it("creates the tracker and installs the skill into the default .agents/skills from scratch", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-fresh-"));
    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("created .bearing and installed the wayfinder skill at .agents/skills");

    await assertDirectory(join(root, ".bearing", "backlog"));
    await assertDirectory(join(root, ".bearing", "tickets"));
    await assertDirectory(join(root, ".bearing", "maps"));
    await assertFile(join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"));

    const marker = await readMarker(root);
    expect(marker.version).toBe(packaged().version);
    expect(marker.digest).toBe(packaged().digest);
    await rm(root, { recursive: true, force: true });
  });

  it("uses the sole existing .agents convention", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-agents-"));
    await mkdir(join(root, ".agents", "skills"), { recursive: true });

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("installed the wayfinder skill at .agents/skills");
    await assertFile(join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"));
    await rm(root, { recursive: true, force: true });
  });

  it("uses the sole existing .claude convention", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-claude-"));
    await mkdir(join(root, ".claude", "skills"), { recursive: true });

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("installed the wayfinder skill at .claude/skills");
    await assertFile(join(root, ".claude", "skills", SKILL_DIRECTORY, "SKILL.md"));
    await rm(root, { recursive: true, force: true });
  });

  it("asks which destination when both conventions exist distinctly and installs there", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-both-"));
    await mkdir(join(root, ".agents", "skills"), { recursive: true });
    await mkdir(join(root, ".claude", "skills"), { recursive: true });

    const asked: string[][] = [];
    const ask: AskDestination = async (candidates) => {
      asked.push([...candidates]);
      return ".claude/skills";
    };

    const result = await init(root, ask);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(asked).toEqual([[".agents/skills", ".claude/skills"]]);
    await assertFile(join(root, ".claude", "skills", SKILL_DIRECTORY, "SKILL.md"));
    await expect(stat(join(root, ".agents", "skills", SKILL_DIRECTORY))).rejects.toMatchObject({ code: "ENOENT" });
    await rm(root, { recursive: true, force: true });
  });

  it("treats a .claude -> .agents alias as one destination without prompting or duplicating", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-alias-"));
    await mkdir(join(root, ".agents", "skills"), { recursive: true });
    await symlink(join(root, ".agents"), join(root, ".claude"), "dir");

    const result = await init(root, neverAsk);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("installed the wayfinder skill at .agents/skills");
    await assertFile(join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"));

    const direct = await stat(join(root, ".agents", "skills", SKILL_DIRECTORY));
    const viaAlias = await stat(join(root, ".claude", "skills", SKILL_DIRECTORY));
    expect(viaAlias.ino).toBe(direct.ino);
    await rm(root, { recursive: true, force: true });
  });

  it("updates an untouched older installation and its marker on re-run", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-update-"));
    await Promise.all([
      mkdir(join(root, ".bearing", "backlog"), { recursive: true }),
      mkdir(join(root, ".bearing", "tickets"), { recursive: true }),
      mkdir(join(root, ".bearing", "maps"), { recursive: true }),
    ]);
    const wf = wayfinder(root);
    await mkdir(wf, { recursive: true });
    const old = "# Old skill\n";
    await writeFile(join(wf, "SKILL.md"), old);
    await writeFile(
      join(wf, OWNERSHIP_MARKER_FILE),
      `${JSON.stringify({ version: "0.0.0", digest: digestSkillTree([{ path: "SKILL.md", content: old }]) }, null, 2)}\n`,
    );

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("updated the wayfinder skill at .agents/skills");
    await assertFile(join(wf, "SKILL.md"), packaged().files[0]?.content ?? "");
    const marker = await readMarker(root);
    expect(marker.version).toBe(packaged().version);
    expect(marker.digest).toBe(packaged().digest);
    await rm(root, { recursive: true, force: true });
  });

  it("preserves a locally edited skill byte-for-byte and reports a skipped update", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-skip-edit-"));
    expect((await init(root)).exitCode).toBe(0);
    const wf = wayfinder(root);
    const edited = "# My local edit\n";
    await writeFile(join(wf, "SKILL.md"), edited);

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("left the wayfinder skill at .agents/skills untouched (locally modified)");
    expect(await readFile(join(wf, "SKILL.md"), "utf8")).toBe(edited);
    await rm(root, { recursive: true, force: true });
  });

  it("preserves a skill with an added file and reports a skipped update", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-skip-add-"));
    expect((await init(root)).exitCode).toBe(0);
    const wf = wayfinder(root);
    await writeFile(join(wf, "notes.md"), "# Notes\n");

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("untouched (locally modified)");
    await assertFile(join(wf, "notes.md"), "# Notes\n");
    await rm(root, { recursive: true, force: true });
  });

  it("preserves a skill with a removed file and reports a skipped update", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-skip-remove-"));
    expect((await init(root)).exitCode).toBe(0);
    const wf = wayfinder(root);
    await unlink(join(wf, "SKILL.md"));

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("untouched (locally modified)");
    await expect(stat(join(wf, "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await rm(root, { recursive: true, force: true });
  });

  it("refuses an unowned same-name collision before writing the tracker or skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-collision-"));
    const wf = wayfinder(root);
    await mkdir(wf, { recursive: true });
    await writeFile(join(wf, "SKILL.md"), "# User's own skill\n");

    const result = await init(root);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("without a bearing ownership marker");
    await expect(stat(join(root, ".bearing"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(wf, "SKILL.md"), "utf8")).toBe("# User's own skill\n");
    await rm(root, { recursive: true, force: true });
  });

  it("refuses a malformed ownership marker before writing the tracker or skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-malformed-"));
    const wf = wayfinder(root);
    await mkdir(wf, { recursive: true });
    await writeFile(join(wf, "SKILL.md"), "# Skill\n");
    await writeFile(join(wf, OWNERSHIP_MARKER_FILE), "not json\n");

    const result = await init(root);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("malformed");
    await expect(stat(join(root, ".bearing"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(wf, OWNERSHIP_MARKER_FILE), "utf8")).toBe("not json\n");
    await rm(root, { recursive: true, force: true });
  });

  it("refuses two physical owned installations before writing the tracker", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-two-owned-"));
    const skill = packaged();
    for (const convention of [".agents", ".claude"] as const) {
      const wf = wayfinder(root, convention);
      await mkdir(wf, { recursive: true });
      await writeFile(join(wf, "SKILL.md"), skill.files[0]?.content ?? "");
      await writeFile(
        join(wf, OWNERSHIP_MARKER_FILE),
        `${JSON.stringify({ version: skill.version, digest: skill.digest }, null, 2)}\n`,
      );
    }

    const result = await init(root);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("multiple owned");
    await expect(stat(join(root, ".bearing"))).rejects.toMatchObject({ code: "ENOENT" });
    await rm(root, { recursive: true, force: true });
  });

  it("refuses extra arguments to init", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-usage-"));
    const stdout = capture();
    const stderr = capture();

    const exitCode = await main(["init", "--json"], stdout.writer, stderr.writer, root);

    expect(exitCode).toBe(1);
    expect(stderr.read()).toBe("usage: bearing init\n");
    await rm(root, { recursive: true, force: true });
  });
});
