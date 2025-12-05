#!/usr/bin/env node
/* eslint-disable no-undef */
import { spawnSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, cpSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");
const targetDir = resolve(repoRoot, "packages/neovim/server");
const bundleSource = resolve(
  repoRoot,
  "packages/language-server/bin/wc-language-server-linux-x64"
);
const typescriptSource = resolve(repoRoot, "node_modules", "typescript");
const typescriptTarget = resolve(targetDir, "node_modules", "typescript");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

console.log("[neovim] bundling language server ->", targetDir);

const buildResult = spawnSync(
  pnpmCmd,
  ["--filter", "@wc-toolkit/language-server", "run", "bundle:executable"],
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
  console.error("[neovim] Executable missing:", bundleSource);
  process.exit(1);
}

if (existsSync(targetDir)) {
  rmSync(targetDir, { recursive: true, force: true });
}

mkdirSync(targetDir, { recursive: true });

// Copy all platform executables
const executables = [
  'wc-language-server-linux-x64',
  'wc-language-server-linux-arm64',
  'wc-language-server-macos-x64', 
  'wc-language-server-macos-arm64',
  'wc-language-server-windows-x64.exe'
];

for (const exe of executables) {
  const source = resolve(repoRoot, "packages/language-server/bin", exe);
  const target = resolve(targetDir, "bin", exe);
  if (existsSync(source)) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    console.log(`[neovim] Copied ${exe} -> ${target}`);
  }
}

// For backward compatibility, create a symlink or copy to the default name
// This will be overridden by the Lua script's OS detection
const defaultTarget = resolve(targetDir, "bin/wc-language-server");
if (existsSync(bundleSource)) {
  copyFileSync(bundleSource, defaultTarget);
  console.log(`[neovim] Created default executable -> ${defaultTarget}`);
}

if (existsSync(typescriptSource)) {
  console.log("[neovim] Copying bundled TypeScript runtime ->", typescriptTarget);
  rmSync(typescriptTarget, { recursive: true, force: true });
  mkdirSync(dirname(typescriptTarget), { recursive: true });
  cpSync(typescriptSource, typescriptTarget, { recursive: true });
} else {
  console.warn(
    "[neovim] Warning: Could not find TypeScript runtime at",
    typescriptSource,
    "— language server will need tsdk from the workspace"
  );
}
