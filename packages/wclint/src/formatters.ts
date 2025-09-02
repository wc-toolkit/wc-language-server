import chalk from "chalk";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import type { ValidationResult } from "./validator.js";

export type OutputFormats =
  | "text"
  | "json"
  | "junit"
  | "checkstyle"
  | "sarif"
  | "html";

export interface FormatterOptions {
  format?: OutputFormats;
  color?: boolean;
  verbose?: boolean;
}

/**
 * Formats validation results based on the specified format
 */
export function formatResults(
  results: ValidationResult[],
  options: FormatterOptions,
): string {
  const fmt = (options.format || "text").toLowerCase();
  switch (fmt) {
    case "json":
      return formatJson(results);
    case "sarif":
      return formatSarif(results);
    case "html":
      return formatHtml(results);
    case "junit":
      return formatJUnit(results);
    case "checkstyle":
      return formatCheckstyle(results);
    case "text":
      return formatText(results, options);
    default:
      return formatCustom(results, fmt);
  }
}

/**
 * Fallback for unknown/custom formats. Emits a JSON wrapper that includes the
 * requested format name and the raw validation results so downstream tools
 * can consume or transform it as needed.
 */
function formatCustom(results: ValidationResult[], formatName: string): string {
  return JSON.stringify({ format: formatName, results }, null, 2);
}

/**
 * Formats results as human-readable text
 */
function formatText(
  results: ValidationResult[],
  options: FormatterOptions,
): string {
  const lines: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let totalHints = 0;

  for (const result of results) {
    if (result.diagnostics.length === 0) {
      if (options.verbose) {
        lines.push(
          `${formatFilePath(result.file, options)} - ${chalk.green("✓ No issues")}`,
        );
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

    lines.push(""); // Empty line between files
  }

  const summary: string[] = [];
  if (totalErrors > 0) {
    summary.push(`${totalErrors} error${totalErrors !== 1 ? "s" : ""}`);
  }
  if (totalWarnings > 0) {
    summary.push(`${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`);
  }
  if (totalInfos > 0) {
    summary.push(`${totalInfos} info${totalInfos !== 1 ? "s" : ""}`);
  }
  if (totalHints > 0) {
    summary.push(`${totalHints} hint${totalHints !== 1 ? "s" : ""}`);
  }

  if (summary.length > 0) {
    lines.push(
      `\nFound ${summary.join(", ")} in ${results.length} file${results.length !== 1 ? "s" : ""}.`,
    );
  } else {
    lines.push(
      `\n${chalk.green("✓ No issues found")} in ${results.length} file${results.length !== 1 ? "s" : ""}.`,
    );
  }

  return lines.join("\n");
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
  xml += '<testsuite name="wclint"';

  const testCases: string[] = [];

  for (const result of results) {
    totalTests++;
    const errors = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error,
    );

    if (errors.length > 0) {
      totalFailures++;
      const failures = errors
        .map(
          (e) =>
            `<failure message="${escapeXml(e.message)}" type="ValidationError">` +
            `Line ${e.range.start.line + 1}, Column ${e.range.start.character + 1}: ${escapeXml(e.message)}` +
            `</failure>`,
        )
        .join("\n    ");

      testCases.push(
        `  <testcase name="${escapeXml(result.file)}" classname="WebComponentValidation">\n` +
          `    ${failures}\n` +
          `  </testcase>`,
      );
    } else {
      testCases.push(
        `  <testcase name="${escapeXml(result.file)}" classname="WebComponentValidation"/>`,
      );
    }
  }

  xml += ` tests="${totalTests}" failures="${totalFailures}">\n`;
  xml += testCases.join("\n") + "\n";
  xml += "</testsuite>";

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

      xml +=
        `    <error line="${line}" column="${column}" severity="${severity}" ` +
        `message="${escapeXml(diagnostic.message)}" source="wclint"/>\n`;
    }

    xml += "  </file>\n";
  }

  xml += "</checkstyle>";
  return xml;
}

/**
 * Formats results as SARIF (Static Analysis Results Interchange Format)
 * Minimal SARIF output that maps files and diagnostics into a single run.
 */
function formatSarif(results: ValidationResult[]): string {
  interface SarifRule {
    id: string;
    shortDescription: { text: string };
    fullDescription?: { text: string };
    helpUri?: string;
    properties?: Record<string, unknown>;
  }

  interface SarifRun {
    tool: {
      driver: {
        name: string;
        informationUri: string;
        rules: SarifRule[];
        properties?: Record<string, unknown>;
      };
    };
    results: unknown[];
  }

  const run: SarifRun = {
    tool: {
      driver: {
        name: "wclint",
        informationUri: "https://github.com/wc-toolkit/wc-language-server",
        rules: [],
        properties: {
          organization: "wc-toolkit",
          repository: "wc-language-server",
        },
      },
    },
    results: [],
  };

  const ruleIndexMap = new Map<string, number>();

  for (const result of results) {
    for (const diagnostic of result.diagnostics) {
      const ruleId = diagnostic.code
        ? String(diagnostic.code)
        : diagnostic.message;
      if (!ruleIndexMap.has(ruleId)) {
        ruleIndexMap.set(ruleId, run.tool.driver.rules.length);
        const rule: SarifRule = {
          id: ruleId,
          shortDescription: { text: diagnostic.message },
          fullDescription: { text: diagnostic.message },
          helpUri: "https://github.com/wc-toolkit/wc-language-server",
          properties: {
            category: "validation",
            defaultSeverity: sarifLevel(diagnostic.severity),
          },
        };

        run.tool.driver.rules.push(rule);
      }

      const sarifResult = {
        ruleId: ruleId,
        ruleIndex: ruleIndexMap.get(ruleId),
        level: sarifLevel(diagnostic.severity),
        message: { text: diagnostic.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: result.file },
              region: {
                startLine: diagnostic.range.start.line + 1,
                startColumn: diagnostic.range.start.character + 1,
                endLine: diagnostic.range.end.line + 1,
                endColumn: diagnostic.range.end.character + 1,
              },
            },
          },
        ],
      };

      run.results.push(sarifResult);
    }
  }

  const sarif = {
    $schema:
      "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
    version: "2.1.0",
    runs: [run],
  };

  return JSON.stringify(sarif, null, 2);
}

function sarifLevel(
  severity: DiagnosticSeverity | undefined,
): "error" | "warning" | "note" {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return "error";
    case DiagnosticSeverity.Warning:
      return "warning";
    case DiagnosticSeverity.Information:
    case DiagnosticSeverity.Hint:
    default:
      return "note";
  }
}

/**
 * Simple HTML report generator. Produces a single-file HTML page summarizing files
 * and diagnostics. This is intentionally minimal and safe for CI artifact publishing.
 */
function formatHtml(results: ValidationResult[]): string {
  const escape = (s: string) => escapeXml(s).replace(/\n/g, "<br/>");
  const severityClass = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "error":
        return "severity-error";
      case "warning":
        return "severity-warning";
      case "info":
        return "severity-info";
      case "hint":
        return "severity-hint";
      default:
        return "severity-unknown";
    }
  };

  const rows = results
    .map((result) => {
      const file = escape(result.file);
      if (result.diagnostics.length === 0) {
        return `
<details class="file" id="file-${file}">
  <summary>${file} <span class="badge ok">No issues</span></summary>
</details>`;
      }

      const items = result.diagnostics
        .map((d) => {
          const line = d.range.start.line + 1;
          const col = d.range.start.character + 1;
          const sev = getSeverityName(d.severity);
          const cls = severityClass(sev);
          return `
  <li class="diag ${cls}">
    <span class="sev">${escape(sev)}</span>
    <span class="loc">${line}:${col}</span>
    <span class="msg">${escape(d.message)}</span>
  </li>`;
        })
        .join("\n");

      return `
<details class="file" open>
  <summary>${file} <span class="badge issues">${result.diagnostics.length} issue${result.diagnostics.length !== 1 ? "s" : ""}</span></summary>
  <ul class="diagnostics">${items}
  </ul>
</details>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>wclint report</title>
  <style>
    :root{--bg:#0f1724;--card:#0b1220;--muted:#94a3b8;--accent:#60a5fa;--ok:#10b981;--err:#ef4444;--warn:#f59e0b}
    /* Light fallback */
    @media (prefers-color-scheme: light){:root{--bg:#f8fafc;--card:#ffffff;--muted:#475569;--accent:#0369a1;--ok:#047857;--err:#b91c1c;--warn:#b45309}}
    html,body{height:100%;margin:0;padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial}
    body{background:linear-gradient(180deg,rgba(0,0,0,0.03),transparent 40%),var(--bg);color:var(--muted);padding:24px}
    .container{max-width:1000px;margin:0 auto}
    h1{color:var(--accent);margin:0 0 12px;font-weight:600}
    .summary{background:var(--card);padding:12px;border-radius:8px;color:var(--muted);display:flex;gap:12px;align-items:center;margin-bottom:16px}
    .summary .stat{font-weight:600;color:inherit}
    details.file{background:var(--card);margin:12px 0;padding:12px;border-radius:8px;color:var(--muted)}
    details.file[open]{box-shadow:0 6px 18px rgba(2,6,23,0.6)}
    summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;outline:none}
    .badge{font-size:12px;padding:4px 8px;border-radius:999px;background:rgba(2,6,23,0.16);color:var(--muted);margin-left:auto}
    .badge.ok{background:linear-gradient(90deg,var(--ok),#34d399);color:#021124}
    .badge.issues{background:linear-gradient(90deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01));color:var(--muted);border:1px solid rgba(255,255,255,0.02)}
    ul.diagnostics{margin:12px 0 0;padding:0 0 0 0;list-style:none}
    li.diag{display:grid;grid-template-columns:120px 80px 1fr;gap:12px;padding:8px;border-radius:6px;margin-bottom:8px;background:linear-gradient(90deg,rgba(255,255,255,0.01),transparent)}
    .diag .sev{font-weight:700}
    .severity-error .sev{color:var(--err)}
    .severity-warning .sev{color:var(--warn)}
    .severity-info .sev{color:var(--accent)}
    .severity-hint .sev{color:var(--ok)}
    .loc{color:rgba(255,255,255,0.6)}
    .msg{color:inherit}
    @media (max-width:640px){li.diag{grid-template-columns:1fr;}}
  </style>
</head>
<body>
  <div class="container">
    <h1>wclint report</h1>
    <div class="summary">
      <div class="stat">Files: <strong>${results.length}</strong></div>
      <div class="stat">Total issues: <strong>${results.reduce((acc, r) => acc + r.diagnostics.length, 0)}</strong></div>
    </div>
    ${rows}
  </div>
</body>
</html>`;

  return html;
}

/**
 * Gets the severity name from DiagnosticSeverity enum
 */
function getSeverityName(severity: DiagnosticSeverity | undefined): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return "Error";
    case DiagnosticSeverity.Warning:
      return "Warning";
    case DiagnosticSeverity.Information:
      return "Info";
    case DiagnosticSeverity.Hint:
      return "Hint";
    default:
      return "Unknown";
  }
}

/**
 * Gets the severity icon
 */
function getSeverityIcon(severity: DiagnosticSeverity | undefined): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return "✖";
    case DiagnosticSeverity.Warning:
      return "⚠";
    case DiagnosticSeverity.Information:
      return "ℹ";
    case DiagnosticSeverity.Hint:
      return "💡";
    default:
      return "?";
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
