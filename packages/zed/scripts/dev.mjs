#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "fs";
import os from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const { console, process } = globalThis;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionDir = resolve(__dirname, "..");
const repoRoot = resolve(extensionDir, "../..");
const defaultWorkspace = resolve(repoRoot, "demos/html");
const zedBinary = process.env.ZED_BIN ?? "zed";
const nodeCmd = process.platform === "win32" ? "node.exe" : "node";

function runStep(label, command, args, options = {}) {
  console.log(`\n[zed dev] ${label}`);
  const result = spawnSync(command, args, {
    cwd: extensionDir,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    console.error(`\n[zed dev] Failed while executing: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

function getExtensionsDevDir() {
  if (process.env.ZED_EXTENSIONS_DIR) {
    return resolve(process.env.ZED_EXTENSIONS_DIR);
  }

  const home = os.homedir();

  if (process.platform === "darwin") {
    return resolve(home, "Library/Application Support/Zed/extensions/dev");
  }

  if (process.platform === "linux") {
    const base = process.env.XDG_DATA_HOME ?? resolve(home, ".local/share");
    return resolve(base, "zed/extensions/dev");
  }

  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? resolve(home, "AppData/Roaming");
    return resolve(base, "Zed/extensions/dev");
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

function resolveWorkspaceDir() {
  if (process.env.ZED_WORKSPACE_DIR) {
    const candidate = resolve(process.env.ZED_WORKSPACE_DIR);
    if (existsSync(candidate)) {
      return candidate;
    }
    console.warn(
      `[zed dev] Provided ZED_WORKSPACE_DIR does not exist: ${candidate}. Falling back to default.`,
    );
  }

  if (existsSync(defaultWorkspace)) {
    return defaultWorkspace;
  }

  return repoRoot;
}

runStep(
  "Build extension artifacts",
  nodeCmd,
  [resolve(__dirname, "build-extension.mjs")]
);

const extensionId = "wc-language-server";
const installDir = resolve(getExtensionsDevDir(), extensionId);
const workspaceDir = resolveWorkspaceDir();
console.log("\n[zed dev] Linking extension ->", installDir);
mkdirSync(dirname(installDir), { recursive: true });
if (existsSync(installDir)) {
  rmSync(installDir, { recursive: true, force: true });
}
symlinkSync(extensionDir, installDir, "dir");

console.log("\n[zed dev] Launching Zed with workspace", workspaceDir);
runStep("Launch Zed", zedBinary, ["--foreground", workspaceDir], { cwd: workspaceDir });
