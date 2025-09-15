#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { validateFiles } from "./validator.js";
import { formatResults, OutputFormats } from "./formatters.js";
import { loadConfig, createConfigFile, validateConfig } from "./config.js";
import { debug, info, error } from "./logger.js";

const program = new Command();

/**
 * Options for running the Web Components linter/validator.
 */
export type LintWebComponentsOptions = {
  /** Output format to use. Known values: `text`, `json`, `junit`, `checkstyle`, `sarif`, `html`. Custom format names are supported. */
  format?: OutputFormats;
  /** When true, enable colored terminal output. Use `--no-color` to disable. */
  color?: boolean;
  /** When true, include files with no issues in the output. */
  verbose?: boolean;
  /** If set, write formatted results to this file instead of printing to stdout. */
  output?: string;
};

type ExpandedLintOptions = LintWebComponentsOptions & {
  /**
   * Path to the configuration file (e.g. `wc.config.js`).
   * This is used for testing purposes.
   * This should not be set in production because not using a config
   *  at the root of the project with a custom file name will cause
   *  the linter and language server to not find the config.
   */
  config?: string;
};

program
  .description(
    "CLI tool for validating Web Components using Custom Elements Manifest"
  )
  .command("validate")
  .argument(
    "[patterns...]",
    "File patterns to validate (defaults to config include patterns)"
  )
  .option("-c, --config <path>", "Path to configuration file")
  .option(
    "-f, --format <format>",
    "Output format (text, json, junit, checkstyle, sarif, html)",
    "text"
  )
  .option("-o, --output <file>", "Write formatted output to a file")
  .option("--no-color", "Disable colored output")
  .option("-v, --verbose", "Show files with no issues")
  .action(async (patterns: string[], options: ExpandedLintOptions) => {
    // Delegate to programmatic runner; when the CLI is executed directly we
    // still want the same behavior, so call lintWebComponents and exit with its code.
    const code = await lintWebComponents(patterns, options);
    process.exit(code);
  });

/**
 * Programmatic adapter for the `validate` command so tests can call the
 * validation logic without spawning a Node process. Returns an exit code.
 *
 * @param {string[]} patterns File patterns to validate (defaults to config include patterns)
 * @param {LintWebComponentsOptions} options Linting options
 * @returns {Promise<number>} Exit code - 0 if successful, 1 if errors were found
 */
export async function lintWebComponents(
  patterns: string[] = [],
  options: ExpandedLintOptions = {}
): Promise<number> {
  try {
    // Normalize patterns: if a single string with newlines was provided, split it.
    if (patterns.length === 1 && typeof patterns[0] === "string") {
      const single = patterns[0].trim();
      patterns = single
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      debug("Normalized newline-separated patterns:", patterns);
    }

    // Load configuration
    debug("Loading config from:", options.config || "current directory");
    debug("Current working directory:", process.cwd());
    const config = await loadConfig(options.config);
    debug("Loaded config:", JSON.stringify(config, null, 2));

    // Validate configuration
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      error(chalk.red("Configuration errors:"));
      configErrors.forEach((err) => error(chalk.red(`  - ${err}`)));
      return 1;
    }

    // Validate files
    info(chalk.blue("🔍 Validating Web Components..."));
    const results = await validateFiles(patterns, config, options.config);
    const output = formatResults(results, {
      format: (options.format as OutputFormats | undefined) || "text",
      color: options.color,
      verbose: options.verbose,
    });

    // If an output path was provided, write the formatted output to that file.
    if (options.output) {
      try {
        await fs.promises.writeFile(options.output, output, "utf8");
        info(`Wrote output to: ${options.output}`);
      } catch (writeErr) {
        error(chalk.red("Failed to write output file:"), writeErr);
        return 1;
      }
    } else {
      info(output);
    }

    // Return non-zero on validation errors
    const hasErrors = results.some((result) =>
      result.diagnostics.some((diagnostic) => diagnostic.severity === 1)
    );

    return hasErrors ? 1 : 0;
  } catch (err) {
    error(chalk.red("Error:"), err);
    return 1;
  }
}

program
  .command("init")
  .description("Create a sample configuration file")
  .option("-f, --file <filename>", "Configuration file name", "wc.config.js")
  .action(async (options) => {
    try {
      await createConfigFile(options.file);
      info(chalk.green(`✓ Created configuration file: ${options.file}`));
      info(
        chalk.blue(
          "You can now customize the configuration to fit your project needs."
        )
      );
      process.exit(0);
    } catch (err) {
      error(chalk.red("Error creating configuration file:"), err);
      process.exit(1);
    }
  });

// Error handling for unknown commands
program.on("command:*", () => {
  error(chalk.red(`Unknown command: ${program.args.join(" ")}`));
  info(chalk.blue("See --help for available commands"));
  process.exit(1);
});

// Only parse command line arguments when the script is executed directly.
// This prevents side-effects when the module is imported by tests.
try {
  const caller =
    process.argv && process.argv[1] ? path.resolve(process.argv[1]) : null;
  const self = path.resolve(new URL(import.meta.url).pathname);

  // Resolve symlinks for proper comparison in workspace environments
  const realCaller = caller ? fs.realpathSync(caller) : null;
  const realSelf = fs.realpathSync(self);

  if (realCaller && realCaller === realSelf) {
    program.parse(process.argv);
  }
} catch {
  // If any resolution fails, fall back to parsing behavior to preserve CLI when
  // executed directly.
  program.parse(process.argv);
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}
