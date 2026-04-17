import assert from "assert";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import test from "node:test";
import { pathToFileURL } from "url";

const repoRoot = path.resolve(".");
const pnpmCmd =
  globalThis.process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const manifestServicePath = path.resolve(
  "packages/language-server/dist/services/manifest-service.js",
);

function ensureLanguageServerDist() {
  if (fs.existsSync(manifestServicePath)) {
    return;
  }

  const result = spawnSync(
    pnpmCmd,
    ["--filter", "@wc-toolkit/language-server", "exec", "tsc", "-p", "tsconfig.json"],
    {
      cwd: repoRoot,
      stdio: "pipe",
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to compile language-server test fixture.\n${result.stdout}\n${result.stderr}`,
    );
  }
}

test("no package.json import should not throw", async () => {
  // Prepare a temp dir without package.json
  const tmpDir = path.resolve("packages/language-server/test-tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Ensure no package.json
  const pkgPath = path.join(tmpDir, "package.json");
  if (fs.existsSync(pkgPath)) fs.unlinkSync(pkgPath);

  ensureLanguageServerDist();

  // Dynamically import the compiled manifest service; should not throw
  await import(pathToFileURL(manifestServicePath).href);
  assert.ok(true);
});
