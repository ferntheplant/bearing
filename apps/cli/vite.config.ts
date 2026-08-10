import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

import { packagedSkillPlugin } from "./scripts/packaged-skill-plugin.ts";

const SKILL_ROOT = fileURLToPath(new URL("../../skills/wayfinder", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@bearing/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
    },
  },
  pack: {
    entry: ["src/cli.ts"],
    format: ["esm"],
    plugins: [packagedSkillPlugin(SKILL_ROOT)],
    deps: {
      // Core is bundled into the CLI (ADR 0020); `yaml` rides along because it is
      // core's dependency, not the CLI's, and onlyBundle: false says that bundling
      // is intended rather than accidental.
      alwaysBundle: ["@bearing/core"],
      onlyBundle: false,
    },
    sourcemap: true,
  },
  run: {
    tasks: {
      build: { command: "vp pack", dependsOn: ["@bearing/core#build"] },
      test: {
        command: "bunx --bun vp test run --reporter=minimal apps/cli",
        cwd: "../..",
      },
    },
  },
});
