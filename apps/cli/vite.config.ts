import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/cli.ts"],
    format: ["esm"],
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
      // Vitest runs under Bun, not the Node runtime `vp test` uses, because the
      // code under test wires Bun's platform services. `scripts/bun-test.ts`
      // resolves the bundled vitest copy (the one `vite-plus/test` imports) and
      // runs it with Bun.
      test: {
        command: "bun scripts/bun-test.ts run --reporter=minimal apps/cli",
        cwd: "../..",
      },
    },
  },
});
