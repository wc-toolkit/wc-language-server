#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const WASM_TARGET = "wasm32-wasip1";

console.log(`[zed] Building debug wasm component (${WASM_TARGET})…`);
run("cargo", ["component", "build", "--target", WASM_TARGET], { cwd: projectRoot });

const wasmSource = path.join(
  projectRoot,
  "target",
  WASM_TARGET,
  "debug",
  "wc_zed_extension.wasm",
);
const wasmDestination = path.join(projectRoot, "extension.wasm");

if (!fs.existsSync(wasmSource)) {
  console.error(
    `Could not find ${wasmSource}. Make sure the ${WASM_TARGET} target is installed (rustup target add ${WASM_TARGET}).`,
  );
  process.exit(1);
}

fs.copyFileSync(wasmSource, wasmDestination);
console.log(`[zed] Copied ${wasmSource} → ${wasmDestination}`);

const bundledServer = path.join(
  projectRoot,
  "language-server",
  "bin",
  "wc-language-server.js",
);

if (!fs.existsSync(bundledServer)) {
  console.error(
    `[zed] Missing bundled language server at ${bundledServer}. Run "pnpm run sync-language-server" first.`,
  );
  process.exit(1);
}

installDevExtension();

const zedBinary = resolveZedBinary();
if (!zedBinary) {
  console.warn(
    "[zed] Zed CLI not found. The extension assets are built, but you'll need to run `zed: install dev extension` inside Zed and point it to:",
  );
  console.warn(`      ${projectRoot}`);
  process.exit(0);
}

const workspacePath = process.env.ZED_WORKSPACE_PATH ??
  path.resolve(projectRoot, "..", "..", "demos", "html");

console.log(
  "[zed] Launching Zed (foreground). Once it opens, run `zed: install dev extension` and select:",
);
console.log(`      ${projectRoot}`);
console.log("[zed] Opening workspace:", workspacePath);

const foregroundResult = spawnSync(
  zedBinary,
  ["--foreground", workspacePath],
  {
    stdio: "inherit",
  },
);
process.exit(foregroundResult.status ?? 0);

function resolveZedBinary() {
  if (process.env.ZED_BIN) {
    const expanded = expandUserPath(process.env.ZED_BIN);
    if (fs.existsSync(expanded)) {
      return expanded;
    }
  }

  const detected = detectInPath();
  if (detected) {
    return detected;
  }

  const macDefault = "/Applications/Zed.app/Contents/MacOS/zed";
  if (fs.existsSync(macDefault)) {
    return macDefault;
  }

  return null;
}

function detectInPath() {
  const whichResult = spawnSync("which", ["zed"], {
    encoding: "utf8",
  });

  if (whichResult.status === 0) {
    const candidate = whichResult.stdout.trim();
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function expandUserPath(candidate) {
  if (candidate.startsWith("~")) {
    return path.join(process.env.HOME || "", candidate.slice(1));
  }

  return candidate;
}

function installDevExtension() {
  const devExtensionsDir = resolveDevExtensionsDir();
  if (!devExtensionsDir) {
    console.warn("[zed] Could not determine dev extensions directory for this platform; skip auto-install.");
    return;
  }

  const extensionId = "wc-language-server";
  const destinationDir = path.join(devExtensionsDir, extensionId);
  const languageServerSource = path.join(projectRoot, "language-server");
  const extensionToml = path.join(projectRoot, "extension.toml");
  const extensionWasm = path.join(projectRoot, "extension.wasm");

  if (!fs.existsSync(extensionToml) || !fs.existsSync(extensionWasm)) {
    console.warn("[zed] Extension assets missing; skip auto-install.");
    return;
  }

  fs.mkdirSync(devExtensionsDir, { recursive: true });
  fs.rmSync(destinationDir, { force: true, recursive: true });
  fs.mkdirSync(destinationDir, { recursive: true });

  fs.copyFileSync(extensionToml, path.join(destinationDir, "extension.toml"));
  fs.copyFileSync(extensionWasm, path.join(destinationDir, "extension.wasm"));

  if (fs.existsSync(languageServerSource)) {
    fs.cpSync(languageServerSource, path.join(destinationDir, "language-server"), {
      recursive: true,
    });
  }

  console.log(`[zed] Installed dev extension to ${destinationDir}`);
}

function resolveDevExtensionsDir() {
  const home = os.homedir();
  if (!home) {
    return null;
  }

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Zed", "extensions", "dev");
  }

  if (process.platform === "win32") {
    return path.join(home, "AppData", "Roaming", "Zed", "extensions", "dev");
  }

  return path.join(home, ".config", "zed", "extensions", "dev");
}
