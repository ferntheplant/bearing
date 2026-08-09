import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const resolveVitestBin = (): string => {
  const vitePlusDir = dirname(require.resolve("vite-plus/package.json", { paths: [process.cwd()] }));
  const vitestPackagePath = require.resolve("vitest/package.json", { paths: [vitePlusDir, process.cwd()] });
  const packageJson = JSON.parse(readFileSync(vitestPackagePath, "utf-8")) as {
    readonly bin?: string | { readonly vitest?: string };
  };
  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.vitest;
  if (bin === undefined) {
    process.stderr.write(`error: vitest at ${vitestPackagePath} declares no bin\n`);
    process.exit(1);
  }
  return join(dirname(vitestPackagePath), bin);
};

// Vitest runs under Bun, not the Node runtime `vp test` uses, because the code
// under test is Bun's. The runner must be the same physical vitest copy that
// `vite-plus/test` imports re-export, or runner internals split across two
// module instances and suites fail with `runner.config` undefined. `vp test`
// resolves that copy itself; this script mirrors its resolution and launches it
// under Bun.
const result = spawnSync("bun", [resolveVitestBin(), ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
