import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

import { packagedSkillPlugin } from "./apps/cli/scripts/packaged-skill-plugin.ts";

const IGNORE_PATTERNS = ["**/*.gen.ts", "**/dist/**", "**/build/**", "**/coverage/**", ".tanstack/**", ".wrangler/**"];

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@bearing/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
  plugins: [packagedSkillPlugin(fileURLToPath(new URL("./skills/bearing-wayfinder", import.meta.url)))],
  logLevel: "error",
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: IGNORE_PATTERNS,
    useTabs: false,
    tabWidth: 2,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    printWidth: 120,
    insertFinalNewline: true,
    sortImports: true,
    sortPackageJson: true,
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    ignorePatterns: IGNORE_PATTERNS,
    options: {
      typeAware: true,
      typeCheck: true,
      maxWarnings: 0,
    },
    categories: {
      correctness: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/no-explicit-any": "error",
      "react/no-array-index-key": "error",
      "no-console": ["error", { allow: ["debug", "time", "timeEnd", "assert"] }],
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          fix: {
            imports: "safe-fix",
            variables: "fix",
          },
        },
      ],
      "typescript/consistent-type-imports": "error",
      "typescript/no-non-null-assertion": "error",
      "no-param-reassign": "error",
      "typescript/prefer-as-const": "error",
      "default-param-last": "error",
      "react/self-closing-comp": "error",
      "react/rules-of-hooks": "error",
      "typescript/no-unnecessary-template-expression": "error",
      "eslint/prefer-template": "error",
      "unicorn/prefer-number-properties": "error",
      "typescript/no-inferrable-types": "error",
      "eslint/no-else-return": "error",
      "eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../**/*"],
              message: "Use absolute imports (unless import is sibling)",
            },
            {
              group: ["effect/unstable/cli"],
              importNames: ["Prompt"],
              message: "Bearing never prompts interactively (ADR 0022)",
            },
          ],
        },
      ],
      "typescript/no-floating-promises": "error",
    },
    env: {
      builtin: true,
    },
  },
  run: {
    cache: true,
  },
  test: {
    passWithNoTests: false,
    // Vitest's 5s default is smaller than the waits real suites declare (an SSE reader asking
    // for 10s, a process probe allowing 20s), so the generic "Test timed out in 5000ms" wins
    // over the assertion that would have said what actually broke. A budget must exceed the
    // longest wait a test can perform; passing tests never spend it.
    testTimeout: 30_000,
    // Suites that stand up a real harness in `beforeAll` need the same margin.
    hookTimeout: 30_000,
  },
});
