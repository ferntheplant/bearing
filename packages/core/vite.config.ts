import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: {
      tsgo: true,
    },
    exports: true,
    format: ["esm"],
    sourcemap: true,
  },
  run: {
    tasks: {
      build: "vp pack",
      // Vitest runs under Bun, not the Node runtime `vp test` uses, because the
      // code under test is Bun's: `BunFileSystem` and `BunPath` are only reachable
      // from a Bun runtime. `scripts/bun-test.ts` resolves the bundled vitest copy
      // (the one `vite-plus/test` imports) and runs it with Bun.
      test: {
        command: "bun scripts/bun-test.ts run --reporter=minimal packages/core",
        cwd: "../..",
      },
    },
  },
});
