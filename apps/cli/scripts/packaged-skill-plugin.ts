import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { relative } from "node:path";

const VIRTUAL_ID = "\0bearing-packaged-skill";

const walkSkillTree = (skillRoot: string): readonly { path: string; content: string }[] => {
  const files: { path: string; content: string }[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      const entryPath = `${directory}/${entry}`;
      const info = lstatSync(entryPath);
      if (info.isSymbolicLink()) {
        throw new Error(`packaged skill must not contain a symbolic link: ${entryPath}`);
      }
      if (info.isDirectory()) {
        walk(entryPath);
      } else if (info.isFile()) {
        files.push({ path: relative(skillRoot, entryPath), content: readFileSync(entryPath, "utf8") });
      }
    }
  };
  walk(skillRoot);
  return files;
};

/**
 * Serves the packaged bearing-wayfinder skill to the CLI bundle as a virtual module that
 * embeds every file of the `skills/bearing-wayfinder` tree. The tsdown pack this workspace
 * builds the binary with does not process `?raw` imports or inline glob raw content,
 * so the tree is read here, at build time, and shipped inside the bundle.
 */
export const packagedSkillPlugin = (skillRoot: string) => ({
  name: "bearing-packaged-skill",
  resolveId(id: string) {
    if (id === "virtual:bearing-skill") {
      return VIRTUAL_ID;
    }
  },
  load(id: string) {
    if (id === VIRTUAL_ID) {
      return `export const skillFiles = ${JSON.stringify(walkSkillTree(skillRoot))};\n`;
    }
  },
});
