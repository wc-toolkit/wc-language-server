#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "..", "..");
const languageServerSrc = path.join(repoRoot, "packages", "language-server");
const languageServerDest = path.join(projectRoot, "language-server");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(languageServerSrc)) {
  console.error("[zed] Could not find packages/language-server. Run this script from within the repository.");
  process.exit(1);
}

console.log("[zed] Building @wc-toolkit/language-server (pnpm --filter ... build)…");
run("pnpm", ["--filter", "@wc-toolkit/language-server", "run", "build"], {
  cwd: repoRoot,
});

console.log("[zed] Recreating language-server directory for the Zed extension…");
fs.rmSync(languageServerDest, { recursive: true, force: true });
fs.mkdirSync(languageServerDest, { recursive: true });

for (const entry of ["bin", "dist", "package.json"]) {
  const fromPath = path.join(languageServerSrc, entry);
  if (!fs.existsSync(fromPath)) {
    console.warn(`[zed] Skipping missing entry: ${entry}`);
    continue;
  }

  const toPath = path.join(languageServerDest, entry);
  fs.cpSync(fromPath, toPath, { recursive: true });
}

console.log("[zed] Installing language server dependencies (npm install --omit=dev)…");
run("npm", ["install", "--omit=dev"], { cwd: languageServerDest });

console.log(`[zed] Bundled language server ready at ${languageServerDest}`);
