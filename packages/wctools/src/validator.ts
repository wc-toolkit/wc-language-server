import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { minimatch } from "minimatch";
import { getLanguageService } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver-types";
import { getValidation } from "../../language-server/src/plugins/index.js";
import { debug, warn } from "../../language-server/src/utilities/logger.js";
import {
  configurationService,
  customElementsService,
  WCConfig,
} from "../../language-server/src/services/index.js";

export interface ValidationResult {
  file: string;
  diagnostics: Diagnostic[];
}

/**
 * Validates a list of files using the language server validation logic.
 */
export async function validateFiles(
  patterns: string[],
  config: WCConfig,
  configPath?: string,
): Promise<ValidationResult[]> {
  // Friendly runtime check: if both services are missing it's likely the
  // language-server package hasn't been built or isn't installed. Provide a
  // clear action for contributors and CI.
  if (!configurationService && !customElementsService) {
    throw new Error(
      "Missing @wc-toolkit/language-server services. Please build the workspace (e.g. run `pnpm -w run build`) or ensure @wc-toolkit/language-server is installed and built before running the CLI.",
    );
  }

  const resolvedConfig: WCConfig = { ...config };

  // If a config file path was provided, resolve manifest paths relative to the config file
  if (configPath && resolvedConfig.manifestSrc) {
    const configDir = path.dirname(path.resolve(configPath));

    // If manifestSrc is relative, resolve it relative to the config file directory
    if (
      resolvedConfig.manifestSrc.startsWith("./") ||
      !path.isAbsolute(resolvedConfig.manifestSrc)
    ) {
      resolvedConfig.manifestSrc = path.resolve(
        configDir,
        resolvedConfig.manifestSrc,
      );
    }
  }

  debug(
    `Configuration:`,
    JSON.stringify(resolvedConfig, null, 2),
  );

  configurationService.updateConfig(resolvedConfig);
  // Initialize services with configuration

  // Find files to validate
  const files = await findFiles(patterns, resolvedConfig);
  debug(`${files.length} file(s) found to validate.`)

  // Validate each file
  const results: ValidationResult[] = [];
  const htmlLanguageService = getLanguageService();

  for (const file of files) {
    try {
      debug(`Validating file: ${file}`);
      const content = await fs.promises.readFile(file, "utf-8");
      let fileContent = content;
      const ext = path.extname(file).toLowerCase();

      if (ext === ".md" || ext === ".mdx") {
        // Extract HTML fragments from Markdown/MDX. Prefer fenced HTML blocks
        // (```html) and fall back to stripping code fences so inline HTML
        // remains for validation.
        fileContent = extractHtmlFromMarkdown(fileContent);
      }

      const document = TextDocument.create(
        `file://${file}`,
        getLanguageId(file),
        1,
        fileContent,
      );

      const diagnostics = getValidation(document, htmlLanguageService);

      results.push({
        file: path.relative(process.cwd(), file),
        diagnostics,
      });
    } catch (error) {
      warn(`Warning: Could not read file ${file}:`, error);
    }
  }

  return results;
}

/**
 * Finds files matching the given patterns.
 */
async function findFiles(
  patterns: string[],
  config: WCConfig,
): Promise<string[]> {
  const allFiles = new Set<string>();

  // Use provided patterns or fallback to config include patterns
  const searchPatterns =
    patterns.length > 0 ? patterns : config.include || ["**/*"];

  for (const pattern of searchPatterns) {
    try {
      const files = await glob(pattern, {
        ignore: config.exclude || [
          "node_modules/**",
          ".git/**",
          "dist/**",
          "build/**",
        ],
        absolute: true,
        nodir: true,
      });

      files.forEach((file) => {
        if (shouldValidateFile(file, config)) {
          allFiles.add(file);
        }
      });
    } catch (err: unknown) {
      warn(`Warning: Could not process pattern ${pattern}:`, err);
    }
  }

  return Array.from(allFiles);
}

/**
 * Determines if a file should be validated based on its extension.
 */
function shouldValidateFile(filePath: string, config: WCConfig): boolean {
  // Compare include/exclude patterns against a relative, normalized path so
  // patterns like "src/**/*.html" match (they won't match an absolute path).
  const rel = path.relative(process.cwd(), filePath);
  const candidate = rel.startsWith("..") ? filePath : rel;
  const normalized = candidate.split(path.sep).join("/");

  if (config.include && config.include.length > 0) {
    const includeMatch = config.include.some((pattern: string) =>
      minimatch(normalized, pattern),
    );
    if (!includeMatch) return false;
  }

  if (config.exclude && config.exclude.length > 0) {
    const excludeMatch = config.exclude.some((pattern: string) =>
      minimatch(normalized, pattern),
    );
    if (excludeMatch) return false;
  }

  return true;
}

/**
 * Gets the language ID for a file based on its extension.
 */
function getLanguageId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".html":
    case ".htm":
      return "html";
    case ".js":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".jsx":
      return "javascriptreact";
    case ".tsx":
      return "typescriptreact";
    case ".vue":
      return "vue";
    case ".svelte":
      return "svelte";
    case ".md":
    case ".mdx":
      // Treat Markdown/MDX as HTML for embedded markup validation. MDX may
      // contain JSX, but we validate HTML fragments (custom elements) inside
      // markdown pages by using the HTML language service.
      return "html";
    default:
      return "html"; // Default to HTML for unknown extensions
  }
}

/**
 * Very small Markdown/MDX HTML extractor.
 *
 * - Collects content from fenced HTML blocks (```html ... ```).
 * - Removes other fenced code blocks so their code doesn't get treated as HTML.
 * - Leaves inline HTML untouched.
 */
function extractHtmlFromMarkdown(md: string): string {
  // Capture ```html blocks
  const htmlFenceRegex = /```html\n([\s\S]*?)\n```/gi;
  let match: RegExpExecArray | null;
  const parts: string[] = [];

  while ((match = htmlFenceRegex.exec(md))) {
    parts.push(match[1]);
  }

  // Remove all fenced code blocks (```lang ... ```) to avoid validating non-HTML code
  const stripped = md.replace(/```[\s\S]*?```/g, "\n");

  // Combine extracted HTML fences and stripped markdown (which may still contain inline HTML)
  return parts.join("\n") + "\n" + stripped;
}
