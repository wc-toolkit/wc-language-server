#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { validateFiles } from "./validator.js";
import { formatResults } from "./formatters.js";
import { loadConfig, createConfigFile, validateConfig } from "./config.js";
import { debug, info, error } from "./logger.js";

const program = new Command();

program
  .name("wclint")
  .description(
    "CLI tool for validating Web Components using Custom Elements Manifest"
  )
  .version("1.0.0");

program
  .command("validate")
  .description("Validate Web Component")
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
  .action(async (patterns: string[], options) => {
    // Delegate to programmatic runner; when the CLI is executed directly we
    // still want the same behavior, so call runValidate and exit with its code.
    const code = await runValidate(patterns, options);
    process.exit(code);
  });

/**
 * Programmatic adapter for the `validate` command so tests can call the
 * validation logic without spawning a Node process. Returns an exit code.
 */
export async function runValidate(
  patterns: string[] = [],
  options: {
    config?: string;
    format?: string;
    color?: boolean;
    verbose?: boolean;
    output?: string;
  } = {}
): Promise<number> {
  try {
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

    // If output filename is provided and no explicit format was set, try to
    // infer the desired format from the file extension.
    let chosenFormat = options.format as
      | "text"
      | "json"
      | "junit"
      | "checkstyle"
      | "sarif"
      | "html"
      | undefined;

    if (!chosenFormat && options.output) {
      const ext = path.extname(options.output).toLowerCase();
      if (ext === ".sarif") chosenFormat = "sarif";
      else if (ext === ".html" || ext === ".htm") chosenFormat = "html";
      else if (ext === ".json") chosenFormat = "json";
      else if (ext === ".xml") {
        // Heuristic: prefer checkstyle if filename contains 'check'
        const name = path.basename(options.output).toLowerCase();
        chosenFormat = name.includes("check") ? "checkstyle" : "junit";
      }
    }

    const output = formatResults(results, {
      format:
        (chosenFormat as
          | "text"
          | "json"
          | "junit"
          | "checkstyle"
          | "sarif"
          | "html") || "text",
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
  if (caller && caller === self) {
    program.parse(process.argv);

    // Show help if no command provided
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  }
} catch {
  // If any resolution fails, fall back to parsing behaviour to preserve CLI when
  // executed directly.
  program.parse(process.argv);
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}
