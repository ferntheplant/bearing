import { mkdir, mkdtemp, readFile, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { digestSkillTree, OWNERSHIP_MARKER_FILE, SetupWriteError, SKILL_DIRECTORY } from "@bearing/core";
import { describe, expect, it } from "vite-plus/test";

import { main } from "#src/cli.ts";
import type { SetupRunner } from "#src/setup.ts";
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

const init = async (cwd: string) => {
  const stdout = capture();
  const stderr = capture();
  const exitCode = await main(["init"], stdout.writer, stderr.writer, cwd);
  return { exitCode, stdout: stdout.read(), stderr: stderr.read() };
};

const installedSkill = (root: string) => join(root, ".agents", "skills", SKILL_DIRECTORY);

const markerPath = (root: string) => join(installedSkill(root), OWNERSHIP_MARKER_FILE);

const readMarker = async (root: string) =>
  JSON.parse(await readFile(markerPath(root), "utf8")) as { version: string; digest: string };

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
    expect(result.stdout).toContain("created .bearing and installed the bearing-wayfinder skill at .agents/skills");

    await assertDirectory(join(root, ".bearing", "backlog"));
    await assertDirectory(join(root, ".bearing", "tickets"));
    await assertDirectory(join(root, ".bearing", "maps"));
    await assertFile(join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"));

    const marker = await readMarker(root);
    expect(marker.version).toBe(packaged().version);
    expect(marker.digest).toBe(packaged().digest);
    await rm(root, { recursive: true, force: true });
  });

  it("uses an existing physical .agents/skills home", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-agents-"));
    await mkdir(join(root, ".agents", "skills"), { recursive: true });

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("installed the bearing-wayfinder skill at .agents/skills");
    await assertFile(join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"));
    await rm(root, { recursive: true, force: true });
  });

  it("ignores an existing .claude convention and installs into .agents", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-claude-"));
    await mkdir(join(root, ".claude", "skills"), { recursive: true });

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("installed the bearing-wayfinder skill at .agents/skills");
    await assertFile(join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"));
    await expect(stat(join(root, ".claude", "skills", SKILL_DIRECTORY))).rejects.toMatchObject({ code: "ENOENT" });
    await rm(root, { recursive: true, force: true });
  });

  it("uses .agents when both convention directories exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-both-"));
    await mkdir(join(root, ".agents", "skills"), { recursive: true });
    await mkdir(join(root, ".claude", "skills"), { recursive: true });

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    await assertFile(join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"));
    await expect(stat(join(root, ".claude", "skills", SKILL_DIRECTORY))).rejects.toMatchObject({ code: "ENOENT" });
    await rm(root, { recursive: true, force: true });
  });

  it("refuses an .agents symlink without writing through it", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-alias-"));
    const outside = await mkdtemp(join(tmpdir(), "bearing-init-outside-"));
    await writeFile(join(outside, "untouched.md"), "outside\n");
    await symlink(outside, join(root, ".agents"), "dir");

    const result = await init(root);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("must not contain a symbolic link");
    expect(await readFile(join(outside, "untouched.md"), "utf8")).toBe("outside\n");
    await expect(stat(join(root, ".bearing"))).rejects.toMatchObject({ code: "ENOENT" });
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it("updates an untouched older installation and its marker on re-run", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-update-"));
    await Promise.all([
      mkdir(join(root, ".bearing", "backlog"), { recursive: true }),
      mkdir(join(root, ".bearing", "tickets"), { recursive: true }),
      mkdir(join(root, ".bearing", "maps"), { recursive: true }),
    ]);
    const wf = installedSkill(root);
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
    expect(result.stdout).toContain("updated the bearing-wayfinder skill at .agents/skills");
    await assertFile(join(wf, "SKILL.md"), packaged().files[0]?.content ?? "");
    const marker = await readMarker(root);
    expect(marker.version).toBe(packaged().version);
    expect(marker.digest).toBe(packaged().digest);
    await rm(root, { recursive: true, force: true });
  });

  it("preserves a locally edited skill byte-for-byte and reports a skipped update", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-skip-edit-"));
    expect((await init(root)).exitCode).toBe(0);
    const wf = installedSkill(root);
    const edited = "# My local edit\n";
    await writeFile(join(wf, "SKILL.md"), edited);

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("left the bearing-wayfinder skill at .agents/skills untouched (locally modified)");
    expect(await readFile(join(wf, "SKILL.md"), "utf8")).toBe(edited);
    await rm(root, { recursive: true, force: true });
  });

  it("preserves a skill with an added file and reports a skipped update", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-skip-add-"));
    expect((await init(root)).exitCode).toBe(0);
    const wf = installedSkill(root);
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
    const wf = installedSkill(root);
    await unlink(join(wf, "SKILL.md"));

    const result = await init(root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("untouched (locally modified)");
    await expect(stat(join(wf, "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await rm(root, { recursive: true, force: true });
  });

  it("refuses an unowned same-name collision before writing the tracker or skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-collision-"));
    const wf = installedSkill(root);
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
    const wf = installedSkill(root);
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

  it("renders setup write failures with exit status 1", async () => {
    const root = await mkdtemp(join(tmpdir(), "bearing-init-write-failure-"));
    const stdout = capture();
    const stderr = capture();
    const setup: SetupRunner = async () => {
      throw new SetupWriteError({
        operation: "write-file",
        path: join(root, ".agents", "skills", SKILL_DIRECTORY, "SKILL.md"),
        message: "cannot write packaged skill",
      });
    };

    const exitCode = await main(["init"], stdout.writer, stderr.writer, root, setup);

    expect(exitCode).toBe(1);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toBe("error: cannot write packaged skill\n");
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
