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
      test: {
        command: "bunx --bun vp test run --reporter=minimal packages/core",
        cwd: "../..",
      },
    },
  },
});
