import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const zedDir = resolve(import.meta.dirname, "..");
const packageJsonPath = resolve(zedDir, "package.json");
const cargoTomlPath = resolve(zedDir, "Cargo.toml");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageVersion = packageJson.version;

if (typeof packageVersion !== "string" || packageVersion.length === 0) {
  throw new Error(
    "Expected packages/zed/package.json to contain a valid version string",
  );
}

const cargoToml = readFileSync(cargoTomlPath, "utf8");
const versionPattern = /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*\n)/;

if (!versionPattern.test(cargoToml)) {
  throw new Error(
    "Could not find [package] version in packages/zed/Cargo.toml",
  );
}

const updatedCargoToml = cargoToml.replace(
  versionPattern,
  `$1${packageVersion}$2`,
);

if (updatedCargoToml !== cargoToml) {
  writeFileSync(cargoTomlPath, updatedCargoToml, "utf8");
  console.log(`Updated Cargo.toml version to ${packageVersion}`);
} else {
  console.log(`Cargo.toml version already matches ${packageVersion}`);
}
