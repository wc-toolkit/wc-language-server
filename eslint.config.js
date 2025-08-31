// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "**/dist/",
      "**/build/",
      "**/demos/",
      "*.tsbuildinfo",
      ".vscode/",
      ".DS_Store",
      "coverage/",
      ".parcel-cache/",
      ".next/",
      "out/",
      ".turbo/",
      "*.min.js",
      "lib/",
      "esm/",
      "cjs/",
      "packages/**/dist/",
      "packages/**/build/",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
    ],
  }
);
