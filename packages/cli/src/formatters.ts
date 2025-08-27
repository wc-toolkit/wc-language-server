import chalk from 'chalk';
import { DiagnosticSeverity } from 'vscode-languageserver-types';
import type { ValidationResult } from './validator.js';

export interface FormatterOptions {
  format: 'text' | 'json' | 'junit' | 'checkstyle';
  color?: boolean;
  verbose?: boolean;
}

/**
 * Formats validation results based on the specified format
 */
export function formatResults(
  results: ValidationResult[],
  options: FormatterOptions
): string {
  switch (options.format) {
    case 'json':
      return formatJson(results);
    case 'junit':
      return formatJUnit(results);
    case 'checkstyle':
      return formatCheckstyle(results);
    case 'text':
    default:
      return formatText(results, options);
  }
}

/**
 * Formats results as human-readable text
 */
function formatText(results: ValidationResult[], options: FormatterOptions): string {
  const lines: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let totalHints = 0;

  for (const result of results) {
    if (result.diagnostics.length === 0) {
      if (options.verbose) {
        lines.push(`${formatFilePath(result.file, options)} - ${chalk.green('✓ No issues')}`);
      }
      continue;
    }

    lines.push(`${formatFilePath(result.file, options)}:`);

    for (const diagnostic of result.diagnostics) {
      const severity = getSeverityName(diagnostic.severity);
      const severityIcon = getSeverityIcon(diagnostic.severity);
      const color = getSeverityColor(diagnostic.severity);
      
      const line = diagnostic.range.start.line + 1;
      const character = diagnostic.range.start.character + 1;
      const location = `${line}:${character}`;
      
      const message = options.color 
        ? `  ${color(`${severityIcon} ${severity}`)} ${location} ${diagnostic.message}`
        : `  ${severityIcon} ${severity} ${location} ${diagnostic.message}`;
      
      lines.push(message);

      // Count by severity
      switch (diagnostic.severity) {
        case DiagnosticSeverity.Error:
          totalErrors++;
          break;
        case DiagnosticSeverity.Warning:
          totalWarnings++;
          break;
        case DiagnosticSeverity.Information:
          totalInfos++;
          break;
        case DiagnosticSeverity.Hint:
          totalHints++;
          break;
      }
    }
    
    lines.push(''); // Empty line between files
  }

  // Summary
  const summary: string[] = [];
  if (totalErrors > 0) summary.push(`${totalErrors} error${totalErrors !== 1 ? 's' : ''}`);
  if (totalWarnings > 0) summary.push(`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`);
  if (totalInfos > 0) summary.push(`${totalInfos} info${totalInfos !== 1 ? 's' : ''}`);
  if (totalHints > 0) summary.push(`${totalHints} hint${totalHints !== 1 ? 's' : ''}`);

  if (summary.length > 0) {
    lines.push(`\nFound ${summary.join(', ')} in ${results.length} file${results.length !== 1 ? 's' : ''}.`);
  } else {
    lines.push(`\n${chalk.green('✓ No issues found')} in ${results.length} file${results.length !== 1 ? 's' : ''}.`);
  }

  return lines.join('\n');
}

/**
 * Formats results as JSON
 */
function formatJson(results: ValidationResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Formats results as JUnit XML
 */
function formatJUnit(results: ValidationResult[]): string {
  let totalTests = 0;
  let totalFailures = 0;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<testsuite name="wc-validate"';

  const testCases: string[] = [];
  
  for (const result of results) {
    totalTests++;
    const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
    
    if (errors.length > 0) {
      totalFailures++;
      const failures = errors.map(e => 
        `<failure message="${escapeXml(e.message)}" type="ValidationError">` +
        `Line ${e.range.start.line + 1}, Column ${e.range.start.character + 1}: ${escapeXml(e.message)}` +
        `</failure>`
      ).join('\n    ');
      
      testCases.push(
        `  <testcase name="${escapeXml(result.file)}" classname="WebComponentValidation">\n` +
        `    ${failures}\n` +
        `  </testcase>`
      );
    } else {
      testCases.push(`  <testcase name="${escapeXml(result.file)}" classname="WebComponentValidation"/>`);
    }
  }

  xml += ` tests="${totalTests}" failures="${totalFailures}">\n`;
  xml += testCases.join('\n') + '\n';
  xml += '</testsuite>';
  
  return xml;
}

/**
 * Formats results as Checkstyle XML
 */
function formatCheckstyle(results: ValidationResult[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<checkstyle version="1.0">\n';

  for (const result of results) {
    xml += `  <file name="${escapeXml(result.file)}">\n`;
    
    for (const diagnostic of result.diagnostics) {
      const severity = getSeverityName(diagnostic.severity).toLowerCase();
      const line = diagnostic.range.start.line + 1;
      const column = diagnostic.range.start.character + 1;
      
      xml += `    <error line="${line}" column="${column}" severity="${severity}" ` +
             `message="${escapeXml(diagnostic.message)}" source="wc-validate"/>\n`;
    }
    
    xml += '  </file>\n';
  }

  xml += '</checkstyle>';
  return xml;
}

/**
 * Gets the severity name from DiagnosticSeverity enum
 */
function getSeverityName(severity: DiagnosticSeverity | undefined): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return 'Error';
    case DiagnosticSeverity.Warning:
      return 'Warning';
    case DiagnosticSeverity.Information:
      return 'Info';
    case DiagnosticSeverity.Hint:
      return 'Hint';
    default:
      return 'Unknown';
  }
}

/**
 * Gets the severity icon
 */
function getSeverityIcon(severity: DiagnosticSeverity | undefined): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return '✖';
    case DiagnosticSeverity.Warning:
      return '⚠';
    case DiagnosticSeverity.Information:
      return 'ℹ';
    case DiagnosticSeverity.Hint:
      return '💡';
    default:
      return '?';
  }
}

/**
 * Gets the chalk color function for severity
 */
function getSeverityColor(severity: DiagnosticSeverity | undefined) {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return chalk.red;
    case DiagnosticSeverity.Warning:
      return chalk.yellow;
    case DiagnosticSeverity.Information:
      return chalk.blue;
    case DiagnosticSeverity.Hint:
      return chalk.cyan;
    default:
      return chalk.gray;
  }
}

/**
 * Formats file path with color if enabled
 */
function formatFilePath(filePath: string, options: FormatterOptions): string {
  return options.color ? chalk.underline(filePath) : filePath;
}

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
