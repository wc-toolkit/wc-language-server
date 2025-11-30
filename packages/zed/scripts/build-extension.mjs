#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from "child_process";
import { copyFileSync, existsSync, readFileSync } from "fs";
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

const cargoTomlPath = resolve(extensionDir, "Cargo.toml");
let crateName = "wc_language_server_extension";

try {
  const cargoToml = readFileSync(cargoTomlPath, "utf8");
  const nameMatch = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch?.[1]) {
    // Cargo outputs wasm artifacts using underscores instead of hyphens.
    crateName = nameMatch[1].replace(/-/g, "_");
  }
} catch (error) {
  console.warn("\n[zed build] Could not read Cargo.toml, falling back to", crateName);
  console.warn(error instanceof Error ? error.message : error);
}

const wasmSource = resolve(
  extensionDir,
  "target",
  wasmTarget,
  "release",
  `${crateName}.wasm`
);
const wasmOutput = resolve(extensionDir, "extension.wasm");

if (!existsSync(wasmSource)) {
  console.error("\n[zed build] Missing wasm artifact:", wasmSource);
  process.exit(1);
}

console.log("\n[zed build] Copying wasm ->", wasmOutput);
copyFileSync(wasmSource, wasmOutput);

console.log("\n[zed build] Done. Generated extension.wasm and bundled language server.");
