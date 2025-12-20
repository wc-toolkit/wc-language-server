#!/usr/bin/env node
/* eslint-env node */
import { mkdirSync, rmSync, symlinkSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionDir = resolve(__dirname, "..");

function getDevExtensionsDir() {
  if (process.env.ZED_EXTENSIONS_DIR) {
    return resolve(process.env.ZED_EXTENSIONS_DIR, "dev");
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Zed", "extensions", "dev");
  }

  const xdg = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(xdg, "zed", "extensions", "dev");
}

function main() {
  const devDir = getDevExtensionsDir();
  const linkPath = join(devDir, "wc-language-server");

  mkdirSync(devDir, { recursive: true });

  // Remove any existing link or directory to ensure a clean symlink.
  rmSync(linkPath, { recursive: true, force: true });

  symlinkSync(extensionDir, linkPath, "dir");
  console.log(`[zed] Linked dev extension -> ${linkPath}`);
}

try {
  main();
} catch (error) {
  console.error("[zed] Failed to create dev symlink:", error instanceof Error ? error.message : error);
  process.exit(1);
}
