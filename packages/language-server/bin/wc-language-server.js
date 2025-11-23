#!/usr/bin/env node
/* eslint-disable no-undef */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv.includes("--version")) {
  const pkgJSON = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf-8")
  );
  console.log(`${pkgJSON["version"]}`);
  process.exit(0);
}

// Import the language server (process.argv is already set correctly for it to detect --stdio)
try {
  await import("../dist/wc-language-server.bundle.cjs");
} catch (error) {
  console.warn("[language-server] Falling back to unbundled build", error);
  await import("../dist/index.js");
}
