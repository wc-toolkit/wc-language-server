import * as path from "path";
import * as fs from "fs";
import { debug, info, setEnableDebugging, warn } from "../utilities/logger.js";
import { minimatch } from "minimatch";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint" | "off";

export type DiagnosticSeverityOptions = keyof NonNullable<
  WCConfig["diagnosticSeverity"]
>;

type DiagnosticOptions = keyof NonNullable<WCConfig["diagnosticSeverity"]>;

/**  */
export interface LibraryConfig {
  /**
   * Specify a custom path to the CustomElements Manifest
   * The path can be for a local file or a remote URL.
   */
  manifestSrc?: string;

  /** Optional function to format tag names before processing. */
  tagFormatter?: (tagName: string) => string;

  /**
   * Alternative property name that types may be mapped to
   * @default "parsedType"
   */
  typeSrc?: string;

  /** Used to enable debugging output. */
  debug?: boolean;

  /** Diagnostic severity levels for various validation checks. */
  diagnosticSeverity?: {
    /**
     * Severity for invalid boolean attribute values.
     * @default "error"
     */
    invalidBoolean?: DiagnosticSeverity;
    /**
     * Severity for invalid number attribute values.
     * @default "error"
     */
    invalidNumber?: DiagnosticSeverity;
    /**
     * Severity for invalid attribute values.
     * @default "error"
     */
    invalidAttributeValue?: DiagnosticSeverity;
    /**
     * Severity for usage of deprecated attributes.
     * @default "warning"
     */
    deprecatedAttribute?: DiagnosticSeverity;
    /**
     * Severity for usage of deprecated elements.
     * @default "warning"
     */
    deprecatedElement?: DiagnosticSeverity;
    /**
     * Severity for usage of duplicate attributes.
     * @default "error"
     */
    duplicateAttribute?: DiagnosticSeverity;
    /**
     * Severity for usage of unknown elements.
     * @default "warning"
     */
    unknownElement?: DiagnosticSeverity;
    /**
     * Severity for usage of unknown attributes.
     * @default "info"
     */
    unknownAttribute?: DiagnosticSeverity;
  };

  /**
   * Optional function to resolve the module path for a specific component.
   * @param componentName The name of the component.
   * @param tagName The tag name of the component.
   * @param modulePath The original module path.
   * @returns The resolved module path.
   */
  componentModulePath?: (
    componentName: string,
    tagName: string,
    modulePath: string
  ) => string;

  /** Path to a global module to include in all files. */
  globalModulePath?: string;
}

/** Configuration options for the Web Components Language Server. */
export interface WCConfig extends LibraryConfig {
  /**
   * Specifies a list of glob patterns that match files to be included in compilation.
   * If no 'files' or 'include' property is present in a tsconfig.json, the compiler defaults to including all files in the containing directory and subdirectories except those specified by 'exclude'.
   */
  include?: string[];

  /** Specifies a list of files to be excluded from compilation. The 'exclude' property only affects the files included via the 'include'. */
  exclude?: string[];

  /** Library specific configuration. */
  libraries?: {
    /** Configuration for each library by name where the key is package name */
    [libraryName: string]: LibraryConfig;
  };
}

export const DEFAULT_CONFIG: WCConfig = {
  typeSrc: "parsedType",
  diagnosticSeverity: {
    invalidBoolean: "error",
    invalidNumber: "error",
    invalidAttributeValue: "error",
    deprecatedAttribute: "warning",
    deprecatedElement: "warning",
    duplicateAttribute: "error",
    unknownElement: "hint",
    unknownAttribute: "hint",
  },
};

/**
 * Configuration file names to search for (in order of preference)
 * JavaScript/TypeScript files are preferred over JSON
 */
export const CONFIG_FILE_NAMES = [
  "wc.config.js",
  "wc.config.ts",
  "wc.config.mjs",
];

/**
 * Base configuration manager that can be used by both CLI and language server
 */
export class BaseConfigurationManager {
  public config = DEFAULT_CONFIG;

  /**
   * Merges user configuration with default configuration
   */
  protected mergeWithDefaults(userConfig: Partial<WCConfig>): WCConfig {
    const mergedConfig: WCConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      diagnosticSeverity: {
        ...DEFAULT_CONFIG.diagnosticSeverity,
        ...userConfig.diagnosticSeverity,
      },
    };

    // Set default values for each library
    if (userConfig.libraries) {
      mergedConfig.libraries = {};
      for (const [libraryName, libraryConfig] of Object.entries(
        userConfig.libraries
      )) {
        mergedConfig.libraries[libraryName] = {
          ...DEFAULT_CONFIG,
          ...libraryConfig,
          diagnosticSeverity: {
            ...DEFAULT_CONFIG.diagnosticSeverity,
            ...libraryConfig.diagnosticSeverity,
          },
        };
      }
    }

    // Debug summary (omit potentially large objects)
    debug("config:mergeWithDefaults", {
      hasUserConfig: Object.keys(userConfig).length > 0,
      include: mergedConfig.include,
      exclude: mergedConfig.exclude,
      libraries: mergedConfig.libraries
        ? Object.keys(mergedConfig.libraries).length
        : 0,
      debug: mergedConfig.debug,
    });

    return mergedConfig;
  }

  /**
   * Validates configuration values
   */
  protected validateConfig(config: Partial<WCConfig>): Partial<WCConfig> {
    debug("config:validate:start");
    const validSeverities: DiagnosticSeverity[] = [
      "error",
      "warning",
      "info",
      "hint",
      "off",
    ];

    if (config.diagnosticSeverity) {
      const diagnosticKeys = Object.keys(
        DEFAULT_CONFIG.diagnosticSeverity!
      ) as DiagnosticOptions[];

      for (const key of diagnosticKeys) {
        if (
          config.diagnosticSeverity[key] &&
          !validSeverities.includes(config.diagnosticSeverity[key]!)
        ) {
          warn(
            `Invalid diagnostic severity "${config.diagnosticSeverity[key]}" for ${key}. Using "error" instead.`
          );
          debug("config:validate:severityCorrected", {
            key,
            invalid: config.diagnosticSeverity[key],
          });
          config.diagnosticSeverity[key] = "error";
        }
      }
    }

    return config;
  }

  /**
   * Gets detailed validation errors for configuration
   */
  public getConfigValidationErrors(config: WCConfig): string[] {
    const errors: string[] = [];

    // Validate manifestSrc
    if (config.manifestSrc && typeof config.manifestSrc !== "string") {
      errors.push("manifestSrc must be a string");
    }

    // Validate include patterns
    if (config.include && !Array.isArray(config.include)) {
      errors.push("include must be an array of strings");
    }

    // Validate exclude patterns
    if (config.exclude && !Array.isArray(config.exclude)) {
      errors.push("exclude must be an array of strings");
    }

    // Validate diagnostic severity
    if (config.diagnosticSeverity) {
      const validSeverities = ["error", "warning", "info", "hint", "off"];
      for (const [key, value] of Object.entries(config.diagnosticSeverity)) {
        if (typeof value === "string" && !validSeverities.includes(value)) {
          errors.push(
            `diagnosticSeverity.${key} must be one of: ${validSeverities.join(
              ", "
            )}`
          );
        }
      }
    }

    return errors;
  }

  /**
   * Checks if a file should be included based on include/exclude patterns.
   * @param filePath - Absolute file path to check
   * @returns true if the file should be processed, false otherwise
   */
  public shouldIncludeFile(filePath: string): boolean {
    const absNorm = filePath.split(path.sep).join("/");
    const relPath = path.relative(process.cwd(), filePath);
    const relNorm = relPath.split(path.sep).join("/");

    // Build suffix candidates of the relative path so patterns like "src/**/*.ts"
    // match even when the project root has extra leading folders (e.g. packages/pkg-name/src/...).
    const segments = relNorm.split("/");
    const suffixes: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      suffixes.push(segments.slice(i).join("/"));
    }

    const candidates = [absNorm, relNorm, ...suffixes];

    // If no include patterns, default to included (tsc style)
    if (!this.config.include || this.config.include.length === 0) {
      // Still honor excludes
      if (this.config.exclude?.length) {
        const excluded = this.config.exclude?.length
          ? this.config.exclude.some((pattern) =>
              candidates.some((p) => minimatch(p, pattern, { dot: true }))
            )
          : false;
        const decision = !excluded;
        debug("config:file:includeDecision", {
          file: relNorm,
          reason: "no-include-list",
          excluded,
          decision,
        });
        return decision;
      }
      return true;
    }

    const includeMatch = this.config.include.some((pattern) =>
      candidates.some((p) => minimatch(p, pattern, { dot: true }))
    );
    if (!includeMatch) {
      debug("config:file:includeDecision", {
        file: relNorm,
        reason: "no-include-match",
        decision: false,
      });
      return false;
    }

    if (this.config.exclude && this.config.exclude.length > 0) {
      const excludeMatch = this.config.exclude.some((pattern) =>
        candidates.some((p) => minimatch(p, pattern, { dot: true }))
      );
      if (excludeMatch) {
        debug("config:file:includeDecision", {
          file: relNorm,
          reason: "exclude-match",
          decision: false,
        });
        return false;
      }
    }

    debug("config:file:includeDecision", {
      file: relNorm,
      reason: "included",
      decision: true,
    });
    return true;
  }

  /**
   * Get formatted tag name based on configuration
   */
  public getFormattedTagName(tagName: string, libraryName?: string): string {
    if (libraryName && this.config.libraries?.[libraryName]?.tagFormatter) {
      return this.config.libraries[libraryName].tagFormatter!(tagName);
    }
    return tagName;
  }

  /**
   * Update configuration programmatically
   */
  public updateConfig(newConfig: Partial<WCConfig>): void {
    debug("config:update:start", {
      include: newConfig.include,
      exclude: newConfig.exclude,
      libraries: newConfig.libraries
        ? Object.keys(newConfig.libraries).length
        : 0,
      debug: newConfig.debug,
    });
    const validatedConfig = this.validateConfig(newConfig);
    this.config = this.mergeWithDefaults(validatedConfig);
    setEnableDebugging(!!this.config.debug);
    debug("config:update:applied", {
      include: this.config.include,
      exclude: this.config.exclude,
      debug: this.config.debug,
    });
  }
}

/**
 * Finds a configuration file in the given directory
 */
export function findConfigFile(directory: string): string | undefined {
  debug("Searching for config file in directory:", directory);
  debug("Config file names to search:", CONFIG_FILE_NAMES);
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = path.join(directory, fileName);
    debug(
      "Checking config file:",
      filePath,
      "exists:",
      fs.existsSync(filePath)
    );
    if (fs.existsSync(filePath)) {
      info("Found config file:", filePath);
      return filePath;
    }
  }
  debug("No config file found in directory:", directory);
  return undefined;
}

/**
 * Loads and parses a configuration file (supports JS, TS, and MJS)
 */
export async function loadConfigFile(
  filePath: string
): Promise<Partial<WCConfig>> {
  debug("config:file:load", { filePath });
  const ext = path.extname(filePath);

  if (ext === ".json" || ext === "") {
    // JSON file
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } else if (ext === ".js" || ext === ".mjs" || ext === ".ts") {
    // JavaScript/TypeScript file - use dynamic import for ESM compatibility
    const absolutePath = path.resolve(filePath);

    // For TypeScript files, we'll try to import them directly (assuming they're transpiled or using ts-node)
    const fileUrl = `file://${absolutePath}${ext === ".ts" ? "" : ""}`;

    try {
      const module = await import(fileUrl);
      return module.default || module;
    } catch (error) {
      // If direct import fails for .ts files, try without extension (for transpiled JS)
      if (ext === ".ts") {
        const jsPath = filePath.replace(/\.ts$/, ".js");
        if (
          await fs.promises
            .access(jsPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const jsModule = await import(`file://${path.resolve(jsPath)}`);
          return jsModule.default || jsModule;
        }
      }
      throw error;
    }
  } else {
    throw new Error(
      `Unsupported configuration file format: ${ext}. Supported formats: .js, .mjs, .ts, .json`
    );
  }
}

/**
 * Loads configuration from a file or returns default configuration
 */
export async function loadConfig(
  configPath?: string,
  workingDirectory = process.cwd()
): Promise<WCConfig> {
  debug("config:load:entry", { explicit: configPath, cwd: workingDirectory });
  const manager = new BaseConfigurationManager();
  let configFile: string | undefined;

  if (configPath) {
    // Explicit config path provided
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    configFile = configPath;
  } else {
    // Search for config file in working directory
    configFile = findConfigFile(workingDirectory);
  }

  if (!configFile) {
    debug("config:load:usingDefault");
    return manager.config;
  }

  try {
    const userConfig = await loadConfigFile(configFile);
    const validatedConfig = manager["validateConfig"](userConfig);
    const merged = manager["mergeWithDefaults"](validatedConfig);
    debug("config:load:success", {
      file: configFile,
      include: merged.include,
      exclude: merged.exclude,
      libraries: merged.libraries ? Object.keys(merged.libraries).length : 0,
      debug: merged.debug,
    });
    return merged;
  } catch (error) {
    throw new Error(
      `Failed to load configuration from ${configFile}: ${error}`
    );
  }
}
