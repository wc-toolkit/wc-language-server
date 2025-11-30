#!/usr/bin/env node
/* eslint-disable no-undef */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");
const demosDir = resolve(repoRoot, "demos/html");
const devInit = resolve(repoRoot, "packages/neovim/dev/init.lua");

if (!existsSync(devInit)) {
  console.error("Neovim dev init not found:", devInit);
  process.exit(1);
}

function shEscape(value) {
  return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}

const shellCommand = `cd ${shEscape(demosDir)} && NVIM_APPNAME=wc-ls-dev nvim -u ${shEscape(devInit)}`;

if (process.platform === "darwin") {
  const osaScript = `tell application "Terminal"\n` +
    `  activate\n` +
    `  do script "${shellCommand.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"\n` +
    `end tell`;

  const result = spawnSync("osascript", ["-e", osaScript], {
    stdio: "inherit",
  });

  if (result.status === 0) {
    process.exit(0);
  }

  console.warn("Falling back to inline Neovim because osascript failed.");
}

spawnSync(shellCommand, {
  stdio: "inherit",
  shell: true,
  cwd: demosDir,
});
