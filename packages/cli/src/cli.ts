#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { validateFiles } from './validator.js';
import { formatResults } from './formatters.js';
import { loadConfig, createConfigFile, validateConfig } from './config.js';
import { debug, info, error } from './logger.js';

const program = new Command();

program
  .name('wc-validate')
  .description('CLI tool for validating Web Components using Custom Elements Manifest')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate Web Component')
  .argument('[patterns...]', 'File patterns to validate (defaults to config include patterns)')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-f, --format <format>', 'Output format (text, json, junit, checkstyle)', 'text')
  .option('--no-color', 'Disable colored output')
  .option('-v, --verbose', 'Show files with no issues')
  .action(async (patterns: string[], options) => {
    try {
  // Load configuration
  debug('Loading config from:', options.config || 'current directory');
  debug('Current working directory:', process.cwd());
  const config = await loadConfig(options.config);
  debug('Loaded config:', JSON.stringify(config, null, 2));
      
      // Validate configuration
      const configErrors = validateConfig(config);
      if (configErrors.length > 0) {
        error(chalk.red('Configuration errors:'));
        configErrors.forEach(err => error(chalk.red(`  - ${err}`)));
        process.exit(1);
      }

      // Validate files
  info(chalk.blue('🔍 Validating Web Components...'));
      const results = await validateFiles(patterns, config, options.config);

      // Format and display results
      const output = formatResults(results, {
        format: options.format as 'text' | 'json' | 'junit' | 'checkstyle',
        color: options.color,
        verbose: options.verbose
      });

  info(output);

      // Exit with error code if there are errors
      const hasErrors = results.some(result => 
        result.diagnostics.some(diagnostic => diagnostic.severity === 1) // DiagnosticSeverity.Error
      );
      
      if (hasErrors) {
        process.exit(1);
      }
    } catch (err) {
      error(chalk.red('Error:'), err);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a sample configuration file')
  .option('-f, --file <filename>', 'Configuration file name', 'wc.config.json')
  .action(async (options) => {
    try {
  await createConfigFile(options.file);
  info(chalk.green(`✓ Created configuration file: ${options.file}`));
  info(chalk.blue('You can now customize the configuration to fit your project needs.'));
    } catch (err) {
      error(chalk.red('Error creating configuration file:'), err);
      process.exit(1);
    }
  });

// Error handling for unknown commands
program.on('command:*', () => {
  error(chalk.red(`Unknown command: ${program.args.join(' ')}`));
  info(chalk.blue('See --help for available commands'));
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
