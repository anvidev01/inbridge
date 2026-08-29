import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Test doubles need `any`. Stubbing globalThis.fetch means constructing a
    // value that satisfies the full fetch signature -- overloads, RequestInit,
    // Response -- which cannot be expressed without a cast and would obscure
    // what each test is actually asserting. Scoped to the test directory so
    // production code keeps the rule.
    files: ["src/lib/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
