#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const { console, process } = globalThis;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");
const extensionDir = resolve(__dirname, "..");
const serverDir = resolve(extensionDir, "server");
const bundleSource = resolve(
  repoRoot,
  "packages/language-server/bin/wc-language-server.js"
);
const binariesSourceDir = resolve(repoRoot, "packages/language-server/bin");
const bundleCjsSource = resolve(
  repoRoot,
  "packages/language-server/dist/wc-language-server.bundle.cjs"
);
const targetBinary = resolve(serverDir, "bin/wc-language-server.js");
const targetBundle = resolve(serverDir, "dist/wc-language-server.bundle.cjs");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

console.log("[zed] bundling language server ->", targetBinary);

const buildResult = spawnSync(
  pnpmCmd,
  ["--filter", "@wc-toolkit/language-server", "run", "bundle:executable"],
  {
    cwd: repoRoot,
    stdio: "inherit",
  }
);

if (buildResult.status !== 0) {
  console.error("[zed] Failed to build language server bundle. See logs above.");
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(bundleSource) || !existsSync(bundleCjsSource)) {
  console.error("[zed] Language server files missing:", bundleSource, bundleCjsSource);
  process.exit(1);
}

if (existsSync(serverDir)) {
  rmSync(serverDir, { recursive: true, force: true });
}

mkdirSync(dirname(targetBinary), { recursive: true });
copyFileSync(bundleSource, targetBinary);
mkdirSync(dirname(targetBundle), { recursive: true });
copyFileSync(bundleCjsSource, targetBundle);

console.log("[zed] Language server JavaScript bundled successfully ->", targetBinary);
console.log("[zed] Language server bundle copied ->", targetBundle);

if (existsSync(binariesSourceDir)) {
  const binaries = readdirSync(binariesSourceDir)
    .filter((entry) => entry.startsWith("wc-language-server-") && entry !== "wc-language-server.js")
    .map((entry) => ({
      name: entry,
      source: resolve(binariesSourceDir, entry),
      target: resolve(serverDir, "bin", entry),
    }));

  if (binaries.length > 0) {
    mkdirSync(dirname(targetBinary), { recursive: true });
    for (const binary of binaries) {
      copyFileSync(binary.source, binary.target);
    }
    console.log("[zed] Language server binaries copied ->", binaries.length);
  } else {
    console.log("[zed] No language server binaries found to copy.");
  }
} else {
  console.log("[zed] Language server binaries directory missing:", binariesSourceDir);
}

const tsSource = resolve(repoRoot, "node_modules", "typescript");
const tsTarget = resolve(serverDir, "node_modules", "typescript");
const serverPackageJson = resolve(serverDir, "package.json");

if (existsSync(tsSource)) {
  console.log("[zed] Copying bundled TypeScript runtime ->", tsTarget);
  rmSync(tsTarget, { recursive: true, force: true });
  mkdirSync(dirname(tsTarget), { recursive: true });
  cpSync(tsSource, tsTarget, { recursive: true });
} else {
  console.warn(
    "[zed] Warning: Could not find TypeScript runtime at",
    tsSource,
    "— language server will need tsdk from the workspace"
  );
}

const serverPackage = {
  name: "@wc-toolkit/zed-language-server-runtime",
  type: "commonjs",
};

writeFileSync(serverPackageJson, `${JSON.stringify(serverPackage, null, 2)}\n`);
console.log("[zed] Wrote server package manifest ->", serverPackageJson);
