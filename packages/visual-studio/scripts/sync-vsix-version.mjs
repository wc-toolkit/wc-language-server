/* eslint-disable no-undef */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const vsDir = resolve(import.meta.dirname, "..");
const packageJsonPath = resolve(vsDir, "package.json");
const manifestPath = resolve(vsDir, "source.extension.vsixmanifest");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageVersion = packageJson.version;

if (typeof packageVersion !== "string" || packageVersion.length === 0) {
  throw new Error(
    "Expected packages/visual-studio/package.json to contain a valid version string",
  );
}

const manifest = readFileSync(manifestPath, "utf8");
const versionPattern = /(<Identity\s[^>]*\sVersion=")[^"]+(")/;

if (!versionPattern.test(manifest)) {
  throw new Error(
    "Could not find Identity Version attribute in packages/visual-studio/source.extension.vsixmanifest",
  );
}

const updatedManifest = manifest.replace(versionPattern, `$1${packageVersion}$2`);

if (updatedManifest !== manifest) {
  writeFileSync(manifestPath, updatedManifest, "utf8");
  console.log(`Updated source.extension.vsixmanifest version to ${packageVersion}`);
} else {
  console.log(`source.extension.vsixmanifest version already matches ${packageVersion}`);
}
