#!/usr/bin/env node
import { program } from 'commander';
import { glob } from 'glob';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { DiagnosticEngine, DiagnosticResult, WCConfig } from './diagnostic-engine.js';
import { DiagnosticSeverity } from 'vscode-languageserver-types';

interface CLIOptions {
  config?: string;
  format?: 'text' | 'json' | 'checkstyle' | 'junit';
  output?: string;
  failOnError?: boolean;
  failOnWarning?: boolean;
  quiet?: boolean;
}

async function main() {
  program
    .name('wc-lint')
    .description('Web Components linter and validator')
    .version('1.0.0')
    .argument('[patterns...]', 'File patterns to validate', ['**/*.html', '**/*.js', '**/*.ts'])
    .option('-c, --config <path>', 'Path to wc.config.js', 'wc.config.js')
    .option('-f, --format <format>', 'Output format', 'text')
    .option('-o, --output <path>', 'Output file (default: stdout)')
    .option('--fail-on-error', 'Exit with non-zero code on errors', true)
    .option('--fail-on-warning', 'Exit with non-zero code on warnings', false)
    .option('--quiet', 'Only output errors and warnings', false)
    .action(async (patterns: string[], options: CLIOptions) => {
      await runLint(patterns, options);
    });

  await program.parseAsync();
}

async function runLint(patterns: string[], options: CLIOptions) {
  try {
    // Load configuration
    const config = await loadConfig(options.config);
    
    // Find files to validate
    const files = await findFiles(patterns, config);
    
    if (!options.quiet) {
      console.log(chalk.blue(`Found ${files.length} files to validate`));
    }

    // Run validation
    const engine = new DiagnosticEngine(config);
    await engine.initialize();
    const results = await engine.validateFiles(files);

    // Output results
    await outputResults(results, options);

    // Exit with appropriate code
    const hasErrors = results.some(r => 
      r.diagnostics.some(d => d.severity === DiagnosticSeverity.Error)
    );
    const hasWarnings = results.some(r => 
      r.diagnostics.some(d => d.severity === DiagnosticSeverity.Warning)
    );

    if ((hasErrors && options.failOnError) || (hasWarnings && options.failOnWarning)) {
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

async function loadConfig(configPath?: string): Promise<WCConfig> {
  const configFile = configPath || 'wc.config.js';
  
  if (!fs.existsSync(configFile)) {
    return {
      include: ['**/*.html', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
      exclude: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    };
  }

  try {
    // Dynamic import to handle ESM/CJS
    const config = await import(path.resolve(configFile));
    return config.default || config;
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not load config from ${configFile}`), error);
    return {
      include: ['**/*.html', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
      exclude: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    };
  }
}

async function findFiles(patterns: string[], config: WCConfig): Promise<string[]> {
  const allFiles = new Set<string>();
  
  // Use config include patterns if no CLI patterns provided
  const searchPatterns = patterns.length > 0 ? patterns : (config.include || ['**/*.html', '**/*.js', '**/*.ts']);
  
  for (const pattern of searchPatterns) {
    const files = await glob(pattern, { 
      ignore: config.exclude || ['node_modules/**', '.git/**'],
      absolute: true 
    });
    files.forEach((file: string) => allFiles.add(file));
  }

  return Array.from(allFiles);
}

async function outputResults(results: DiagnosticResult[], options: CLIOptions) {
  if (results.length === 0) {
    if (!options.quiet) {
      console.log(chalk.green('✓ No issues found'));
    }
    return;
  }

  const output = formatOutput(results, options.format || 'text');
  
  if (options.output) {
    await fs.promises.writeFile(options.output, output);
    if (!options.quiet) {
      console.log(chalk.blue(`Results written to ${options.output}`));
    }
  } else {
    console.log(output);
  }
}

function formatOutput(results: DiagnosticResult[], format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    
    case 'checkstyle':
      return formatCheckstyle(results);
    
    case 'junit':
      return formatJUnit(results);
    
    case 'text':
    default:
      return formatText(results);
  }
}

function formatText(results: DiagnosticResult[]): string {
  let output = '';
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    output += `\n${chalk.underline(result.file)}\n`;
    
    for (const diagnostic of result.diagnostics) {
      const severity = getSeverityLabel(diagnostic.severity);
      const line = diagnostic.range.start.line + 1;
      const col = diagnostic.range.start.character + 1;
      
      output += `  ${line}:${col}  ${severity}  ${diagnostic.message}`;
      if (diagnostic.source) {
        output += `  ${chalk.gray(diagnostic.source)}`;
      }
      output += '\n';

      if (diagnostic.severity === DiagnosticSeverity.Error) totalErrors++;
      if (diagnostic.severity === DiagnosticSeverity.Warning) totalWarnings++;
    }
  }

  output += `\n${chalk.red(`✖ ${totalErrors} errors`)} ${chalk.yellow(`⚠ ${totalWarnings} warnings`)}\n`;
  return output;
}

function getSeverityLabel(severity?: DiagnosticSeverity): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return chalk.red('error');
    case DiagnosticSeverity.Warning:
      return chalk.yellow('warning');
    case DiagnosticSeverity.Information:
      return chalk.blue('info');
    case DiagnosticSeverity.Hint:
      return chalk.gray('hint');
    default:
      return chalk.gray('unknown');
  }
}

function formatCheckstyle(results: DiagnosticResult[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<checkstyle version="1.0">\n';
  
  for (const result of results) {
    xml += `  <file name="${escapeXml(result.file)}">\n`;
    
    for (const diagnostic of result.diagnostics) {
      const severity = diagnostic.severity === DiagnosticSeverity.Error ? 'error' : 'warning';
      xml += `    <error line="${diagnostic.range.start.line + 1}" `;
      xml += `column="${diagnostic.range.start.character + 1}" `;
      xml += `severity="${severity}" `;
      xml += `message="${escapeXml(diagnostic.message)}" `;
      xml += `source="${escapeXml(diagnostic.source || 'wc-toolkit')}" />\n`;
    }
    
    xml += '  </file>\n';
  }
  
  xml += '</checkstyle>\n';
  return xml;
}

function formatJUnit(results: DiagnosticResult[]): string {
  const totalTests = results.length;
  const failures = results.filter(r => r.diagnostics.some(d => d.severity === DiagnosticSeverity.Error)).length;
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuite tests="${totalTests}" failures="${failures}" name="wc-lint">\n`;
  
  for (const result of results) {
    const hasErrors = result.diagnostics.some(d => d.severity === DiagnosticSeverity.Error);
    xml += `  <testcase name="${escapeXml(result.file)}" classname="wc-lint"`;
    
    if (hasErrors) {
      xml += '>\n';
      xml += '    <failure type="ValidationError">';
      xml += escapeXml(result.diagnostics.map(d => d.message).join('\n'));
      xml += '</failure>\n';
      xml += '  </testcase>\n';
    } else {
      xml += ' />\n';
    }
  }
  
  xml += '</testsuite>\n';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});
