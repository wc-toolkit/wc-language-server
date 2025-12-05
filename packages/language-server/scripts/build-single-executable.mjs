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

// Define targets to build for
const targets = [
  { target: 'bun-linux-x64', suffix: 'linux-x64' },
  { target: 'bun-linux-arm64', suffix: 'linux-arm64' },
  { target: 'bun-darwin-x64', suffix: 'macos-x64' },
  { target: 'bun-darwin-arm64', suffix: 'macos-arm64' },
  { target: 'bun-windows-x64', suffix: 'windows-x64' },
];

async function run() {
  console.log("[language-server] Building single-file executables for all platforms with Bun...");

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

  // Build for each target
  for (const { target, suffix } of targets) {
    const executableName = `wc-language-server-${suffix}${suffix.includes('windows') ? '.exe' : ''}`;
    const outFile = resolve(packageRoot, "bin", executableName);

    console.log(`[language-server] Compiling bundle to executable for ${suffix}...`);
    const command = `bun build "${bundleFile}" --compile --outfile "${outFile}" --target ${target}`;
    try {
      execSync(command, { stdio: "inherit", cwd: packageRoot });
    } catch (error) {
      console.error(`[language-server] Failed to build executable for ${suffix}`, error);
      process.exit(1);
    }

    // Make sure it's executable (skip for Windows)
    if (existsSync(outFile) && !suffix.includes('windows')) {
      chmodSync(outFile, 0o755);
    }

    if (existsSync(outFile)) {
      console.log(`[language-server] Created executable for ${suffix}:`, outFile);
    } else {
      console.error(`[language-server] Executable not found for ${suffix}`);
      process.exit(1);
    }
  }

  console.log("[language-server] All executables built successfully");
}

run().catch((error) => {
  console.error("[language-server] Failed to build single-file executable", error);
  process.exitCode = 1;
});