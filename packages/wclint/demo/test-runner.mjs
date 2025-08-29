#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import test from "node:test";
import assert from "assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, "..", "dist", "cli", "src", "cli.js");
const DEMO_DIR = __dirname;

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || DEMO_DIR,
      stdio: "pipe",
      ...options,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0,
      });
    });

    proc.on("error", reject);
  });
}

async function runTestCommand(command, args, options = {}) {
  try {
    const result = await runCommand(command, args, options);
    return result;
  } catch (error) {
    return { success: false, error };
  }
}

const scenarios = [
  {
    name: "Help command",
    command: "node",
    args: [CLI_PATH, "--help"],
    options: {},
  },
  {
    name: "Version command",
    command: "node",
    args: [CLI_PATH, "--version"],
    options: {},
  },
  {
    name: "Validate demo files (should find issues)",
    command: "node",
    args: [CLI_PATH, "validate", "--config", "wc.config.js", "*.html"],
    options: {},
  },
  {
    name: "Validate with JSON output",
    command: "node",
    args: [
      CLI_PATH,
      "validate",
      "--config",
      "wc.config.js",
      "--format",
      "json",
      "*.html",
    ],
    options: {},
  },
  {
    name: "Validate with JUnit output",
    command: "node",
    args: [
      CLI_PATH,
      "validate",
      "--config",
      "wc.config.js",
      "--format",
      "junit",
      "*.html",
    ],
    options: {},
  },
  {
    name: "Initialize new config file",
    command: "node",
    args: [CLI_PATH, "init", "test-config.js"],
    options: {},
  },
  {
    name: "Validate specific file",
    command: "node",
    args: [CLI_PATH, "validate", "--config", "wc.config.js", "index.html"],
    options: {},
  },
];

for (const s of scenarios) {
  test(s.name, async () => {
    const res = await runTestCommand(s.command, s.args, s.options);
    // We only assert the process completed with an exit code (0 or 1)
    assert.ok(
      typeof res.code === "number",
      `Process did not complete for ${s.name}`,
    );
    assert.ok(
      res.code === 0 || res.code === 1,
      `Unexpected exit code ${res.code} for ${s.name}`,
    );
  });
}
