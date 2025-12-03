#!/usr/bin/env node
/* eslint-disable no-undef */
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..", "");
const entryPoint = resolve(packageRoot, "src/index.ts");
const outDir = resolve(packageRoot, "dist");
const outfile = resolve(outDir, "wc-language-server.bundle.mjs");

async function run() {
  mkdirSync(outDir, { recursive: true });

  // Use Bun to bundle everything
  execSync(`bun build "${entryPoint}" --outfile "${outfile}" --target node --format esm --minify --sourcemap`, {
    stdio: "inherit",
    cwd: packageRoot,
  });

  console.log("[language-server] Created single-file bundle:", outfile);
}

run().catch((error) => {
  console.error("[language-server] Failed to build single-file bundle", error);
  process.exitCode = 1;
});
