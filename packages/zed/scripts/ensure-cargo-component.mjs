#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
import { spawnSync } from "node:child_process";

function hasCargoComponent() {
  const result = spawnSync("cargo", ["component", "--version"], {
    stdio: "ignore",
  });

  return result.status === 0;
}

if (hasCargoComponent()) {
  process.exit(0);
}

console.log("[zed] Installing cargo-component (required for WebAssembly components)…");
const install = spawnSync("cargo", ["install", "cargo-component"], {
  stdio: "inherit",
});

if (install.status !== 0) {
  console.error("[zed] Failed to install cargo-component automatically. Please install it manually: `cargo install cargo-component`");
  process.exit(install.status ?? 1);
}

console.log("[zed] cargo-component is ready.");
