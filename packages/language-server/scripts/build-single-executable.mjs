#!/usr/bin/env node
/* eslint-disable no-undef */
import { execSync } from "child_process";
import { chmodSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..", "");
const bundleFile = resolve(packageRoot, "dist/wc-language-server.bundle.cjs");

// Determine platform-specific executable name
const platform = process.platform;
let executableName = "wc-language-server";

if (platform === "win32") {
  executableName += ".exe";
}

const outFile = resolve(packageRoot, "bin", executableName);

async function run() {
  console.log("[language-server] Building single-file executable with Bun...");

  // First, create the esbuild bundle
  console.log("[language-server] Creating esbuild bundle...");
  const bundleCommand = `node ./scripts/build-single-file.mjs`;
  try {
    execSync(bundleCommand, { stdio: "inherit", cwd: packageRoot });
  } catch (error) {
    console.error("[language-server] Failed to create esbuild bundle", error);
    process.exit(1);
  }

  // Check if Bun is available
  try {
    execSync("bun --version", { stdio: "pipe" });
  } catch {
    console.error("[language-server] Bun is not installed. Please install Bun to build the executable.");
    process.exit(1);
  }

  // Run Bun build with compile on the bundle
  console.log("[language-server] Compiling bundle to executable...");
  const command = `bun build "${bundleFile}" --compile --outfile "${outFile}" --target bun --format cjs --minify`;
  try {
    execSync(command, { stdio: "inherit", cwd: packageRoot });
  } catch (error) {
    console.error("[language-server] Failed to build executable", error);
    process.exit(1);
  }

  // Make sure it's executable
  if (existsSync(outFile)) {
    chmodSync(outFile, 0o755);
    console.log("[language-server] Created single-file executable:", outFile);
  } else {
    console.error("[language-server] Executable not found after build");
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("[language-server] Failed to build single-file executable", error);
  process.exitCode = 1;
});