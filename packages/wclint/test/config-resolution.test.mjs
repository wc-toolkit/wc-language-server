/* eslint-disable no-undef */
import assert from "assert";
import path from "path";
import test from "node:test";
import { globSync } from "glob";

const config = "packages/cli/demo/wc.config.js";

function expandDemoFiles() {
  return globSync(path.join("packages", "cli", "demo", "*.html"), {
    absolute: true,
  });
}

test("config resolution - repo root", async () => {
  const { runValidate } = await import("../dist/cli.js");
  const files = expandDemoFiles();
  const code = await runValidate(["--config", config, ...files], { config });
  assert.ok(code === 0 || code === 1, `CLI returned unexpected code: ${code}`);
});

test("config resolution - package cwd", async () => {
  const { runValidate } = await import("../dist/cli.js");
  const files = expandDemoFiles();
  // Simulate running from the package directory by changing cwd temporarily
  const origCwd = process.cwd();
  try {
    // Compute the package root directory from this test file's location so the
    // test behaves correctly whether run from the repo root or the package dir.
    const packageDir = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
    );
    process.chdir(packageDir);
    const code = await runValidate(["--config", config, ...files], { config });
    assert.ok(
      code === 0 || code === 1,
      `CLI returned unexpected code: ${code}`,
    );
  } finally {
    process.chdir(origCwd);
  }
});
