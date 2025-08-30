import test from "node:test";
import assert from "assert";
import fs from "fs";
import path from "path";

const { lintWebComponents } = await import("../dist/cli.js");

test("writes SARIF file when output ends with .sarif", async () => {
  const outDir = path.resolve("test-tmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "out.sarif");

  try {
    const code = await lintWebComponents([], { output: outFile, format: undefined });
    assert.ok(code === 0 || code === 1, `unexpected exit code: ${code}`);
    const content = fs.readFileSync(outFile, "utf8");
    const parsed = JSON.parse(content);
    assert.ok(parsed.version && parsed.runs, "Not valid SARIF");
  } finally {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  }
});
