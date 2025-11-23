#!/usr/bin/env node
import { spawnSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");
const targetDir = resolve(repoRoot, "packages/neovim/server");
const bundleSource = resolve(
  repoRoot,
  "packages/language-server/dist/wc-language-server.bundle.cjs"
);
const targetBinary = resolve(targetDir, "bin/wc-language-server.js");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

console.log("[neovim] bundling language server ->", targetDir);

const buildResult = spawnSync(
  pnpmCmd,
  ["--filter", "@wc-toolkit/language-server", "run", "build"],
  {
    cwd: repoRoot,
    stdio: "inherit",
  }
);

if (buildResult.status !== 0) {
  console.error("[neovim] Failed to build language server bundle. See logs above.");
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(bundleSource)) {
  console.error("[neovim] Bundle missing:", bundleSource);
  process.exit(1);
}

if (existsSync(targetDir)) {
  rmSync(targetDir, { recursive: true, force: true });
}

mkdirSync(dirname(targetBinary), { recursive: true });
copyFileSync(bundleSource, targetBinary);

console.log("[neovim] Language server bundled successfully ->", targetBinary);
