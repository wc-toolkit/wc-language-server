import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { minimatch } from "minimatch";
import { getLanguageService } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic } from "vscode-languageserver-types";
import { getValidation } from "@wc-toolkit/language-server/plugins";
import { info, debug, warn } from "./logger.js";
import {
  configurationService as servicesConfiguration,
  customElementsService as servicesCustomElements,
} from "@wc-toolkit/language-server/services";

// Define WCConfig type locally to avoid import issues
interface WCConfig {
  manifestSrc?: string;
  include?: string[];
  exclude?: string[];
  libraries?: Record<string, unknown>;
  diagnostics?: {
    missingCustomElements?: "error" | "warning" | "info" | "ignore";
    missingMixins?: "error" | "warning" | "info" | "ignore";
    attributeValidation?: "error" | "warning" | "info" | "ignore";
    cssPropertyValidation?: "error" | "warning" | "info" | "ignore";
    slot?: {
      missing?: "error" | "warning" | "info" | "ignore";
      allowUnknown?: boolean;
    };
  };
}

// Minimal interfaces for the language-server services we call.
interface ConfigurationService {
  setWorkspaceRoot?: (root: string) => void;
  updateConfig?: (cfg: Partial<WCConfig>) => void;
}

interface CustomElementsService {
  setWorkspaceRoot?: (root: string) => void;
}

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
  configPath?: string
): Promise<ValidationResult[]> {
  // Static services imported from the language-server package.
  const configurationService = servicesConfiguration as unknown as
    | ConfigurationService
    | undefined;
  const customElementsService = servicesCustomElements as unknown as
    | CustomElementsService
    | undefined;

  // Friendly runtime check: if both services are missing it's likely the
  // language-server package hasn't been built or isn't installed. Provide a
  // clear action for contributors and CI.
  if (!configurationService && !customElementsService) {
    throw new Error(
      "Missing @wc-toolkit/language-server services. Please build the workspace (e.g. run `pnpm -w run build`) or ensure @wc-toolkit/language-server is installed and built before running the CLI."
    );
  }

  // Set workspace root to current working directory or config file directory
  let workspaceRoot = process.cwd();
  const resolvedConfig = { ...config };

  // If a config file path was provided, resolve manifest paths relative to the config file
  if (configPath && resolvedConfig.manifestSrc) {
    const configDir = path.dirname(path.resolve(configPath));
    workspaceRoot = configDir;

    // If manifestSrc is relative, resolve it relative to the config file directory
    if (
      resolvedConfig.manifestSrc.startsWith("./") ||
      !path.isAbsolute(resolvedConfig.manifestSrc)
    ) {
      resolvedConfig.manifestSrc = path.resolve(
        configDir,
        resolvedConfig.manifestSrc
      );
    }
  }

  info(`[CLI Validator] Setting workspace root to: ${workspaceRoot}`);
  debug(
    `[CLI Validator] Configuration:`,
    JSON.stringify(resolvedConfig, null, 2)
  );

  // Initialize services with configuration
  if (configurationService) {
    // Set workspace root first so the service resolves config relative to it
    if (typeof configurationService.setWorkspaceRoot === "function") {
      configurationService.setWorkspaceRoot(workspaceRoot);
    }

    // Use the service API to update configuration rather than mutating the object directly
    if (typeof configurationService.updateConfig === "function") {
      configurationService.updateConfig(resolvedConfig as Partial<WCConfig>);
      info(`[CLI Validator] Configuration applied to service`);
    } else {
      throw new Error(
        "configurationService.updateConfig is required; please upgrade @wc-toolkit/language-server"
      );
    }
  }

  // Try to configure custom elements service with workspace root
  if (
    customElementsService &&
    typeof customElementsService.setWorkspaceRoot === "function"
  ) {
    info(`[CLI Validator] Setting custom elements service workspace root`);
    customElementsService.setWorkspaceRoot(workspaceRoot);
  }

  // Find files to validate
  const files = await findFiles(patterns, resolvedConfig);

  // Validate each file
  const results: ValidationResult[] = [];
  const htmlLanguageService = getLanguageService();

  for (const file of files) {
    try {
      const content = await fs.promises.readFile(file, "utf-8");
      const document = TextDocument.create(
        `file://${file}`,
        getLanguageId(file),
        1,
        content
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
  config: WCConfig
): Promise<string[]> {
  const allFiles = new Set<string>();

  // Use provided patterns or fallback to config include patterns
  const searchPatterns =
    patterns.length > 0 ? patterns : config.include || ["**/*.html"];

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
  const ext = path.extname(filePath).toLowerCase();
  const supportedExtensions = [
    ".html",
    ".htm",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
  ];

  // Check if file extension is supported
  if (!supportedExtensions.includes(ext)) {
    return false;
  }

  // Apply include/exclude filters
  if (config.include && config.include.length > 0) {
    const includeMatch = config.include.some((pattern: string) =>
      minimatch(filePath, pattern, { matchBase: true })
    );
    if (!includeMatch) return false;
  }

  if (config.exclude && config.exclude.length > 0) {
    const excludeMatch = config.exclude.some((pattern: string) =>
      minimatch(filePath, pattern, { matchBase: true })
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
    default:
      return "html"; // Default to HTML for unknown extensions
  }
}
