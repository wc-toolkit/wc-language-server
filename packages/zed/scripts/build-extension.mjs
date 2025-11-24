#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from "child_process";
import { copyFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const { console, process } = globalThis;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionDir = resolve(__dirname, "..");
const wasmTarget = "wasm32-wasip2";
const nodeCmd = process.platform === "win32" ? "node.exe" : "node";

function runStep(label, command, args, options = {}) {
  console.log(`\n[zed build] ${label}`);
  const result = spawnSync(command, args, {
    cwd: extensionDir,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    console.error(`\n[zed build] Failed while executing: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

runStep("Bundle language server", nodeCmd, [resolve(__dirname, "bundle-language-server.mjs")]);
runStep("Install wasm32-wasip2 target", "rustup", ["target", "add", wasmTarget]);
runStep("Build extension", "cargo", ["build", "--release", "--target", wasmTarget]);

const wasmSource = resolve(
  extensionDir,
  "target",
  wasmTarget,
  "release",
  "wc_language_tools_extension.wasm"
);
const wasmOutput = resolve(extensionDir, "extension.wasm");

if (!existsSync(wasmSource)) {
  console.error("\n[zed build] Missing wasm artifact:", wasmSource);
  process.exit(1);
}

console.log("\n[zed build] Copying wasm ->", wasmOutput);
copyFileSync(wasmSource, wasmOutput);

console.log("\n[zed build] Done. Generated extension.wasm and bundled language server.");
