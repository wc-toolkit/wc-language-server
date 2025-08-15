import * as path from "path";
import * as fs from "fs";
import { minimatch } from "minimatch";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

// Add this type for diagnosticSeverity keys
export type DiagnosticSeverityOptions = keyof NonNullable<WCConfig['diagnosticSeverity']>;

/** Configuration options for the Web Components Language Server. */
export interface WCConfig {
  /** 
   * Specifies a list of glob patterns that match files to be included in compilation. 
   * If no 'files' or 'include' property is present in a tsconfig.json, the compiler defaults to including all files in the containing directory and subdirectories except those specified by 'exclude'. 
   */
  include?: string[];

  /** Specifies a list of files to be excluded from compilation. The 'exclude' property only affects the files included via the 'include'. */
  exclude?: string[];

  /** Optional function to format tag names before processing. */
  tagFormatter?: (tagName: string) => string;

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
    modulePath: string,
  ) => string;

  /** Path to a global module to include in all files. */
  globalModulePath?: string;
}

const DEFAULT_CONFIG: WCConfig = {
  diagnosticSeverity: {
    invalidBoolean: "error",
    invalidNumber: "error",
    invalidAttributeValue: "error",
    deprecatedAttribute: "warning",
    deprecatedElement: "warning",
    duplicateAttribute: "error",
  },
};

export class ConfigurationService {
  public config: WCConfig = {};
  private configPath: string;
  private watcher?: fs.FSWatcher;
  private changeListeners: Array<() => void> = [];
  private workspaceRoot: string = "";

  constructor() {
    this.configPath = path.join(this.workspaceRoot, "wc.config.js");
    this.initialize();
  }

  private initialize() {
    this.loadConfig();
    this.watchConfig();
  }

  public loadConfig() {
    try {
      const absConfigPath = path.resolve(this.configPath);
      // Clear require cache for hot reload
      delete require.cache[absConfigPath];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(absConfigPath);
      const userConfig = this.validateConfig(mod.default || mod || {});
      this.config = this.mergeWithDefaults(userConfig);
    } catch {
      this.config = DEFAULT_CONFIG;
    }
    this.notifyListeners();
  }

  private mergeWithDefaults(userConfig: WCConfig): WCConfig {
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      diagnosticSeverity: {
        ...DEFAULT_CONFIG.diagnosticSeverity,
        ...userConfig.diagnosticSeverity,
      },
    };
  }

  /**
   * Checks if a file should be included based on include/exclude patterns.
   * @param filePath - Absolute file path to check
   * @returns true if the file should be processed, false otherwise
   */
  public shouldIncludeFile(filePath: string): boolean {
    
    // If include patterns are specified, file must match at least one
    if (this.config.include && this.config.include.length > 0) {
      const includeMatch = this.config.include.some(pattern => 
        minimatch(filePath, pattern, { matchBase: true })
      );
      if (!includeMatch) {
        return false;
      }
    }

    // If exclude patterns are specified, file must not match any
    if (this.config.exclude && this.config.exclude.length > 0) {
      const excludeMatch = this.config.exclude.some(pattern => 
        minimatch(filePath, pattern, { matchBase: true })
      );
      if (excludeMatch) {
        return false;
      }
    }

    return true;
  }

  private validateConfig(config: WCConfig): WCConfig {
    const validSeverities: DiagnosticSeverity[] = [
      "error",
      "warning",
      "info",
      "hint",
    ];

    if (config.diagnosticSeverity) {
      const diagnosticKeys = [
        "invalidBoolean",
        "invalidNumber",
        "invalidAttributeValue",
        "deprecatedAttribute",
        "deprecatedElement",
        "duplicateAttribute",
      ] as const;

      for (const key of diagnosticKeys) {
        if (
          config.diagnosticSeverity[key] &&
          !validSeverities.includes(config.diagnosticSeverity[key])
        ) {
          console.warn(
            `Invalid diagnostic severity "${config.diagnosticSeverity[key]}" for ${key}. Using "error" instead.`,
          );
          config.diagnosticSeverity[key] = "error";
        }
      }
    }

    // Validate include/exclude patterns
    if (config.include && !Array.isArray(config.include)) {
      console.warn("Invalid 'include' configuration: must be an array of glob patterns.");
      config.include = undefined;
    }

    if (config.exclude && !Array.isArray(config.exclude)) {
      console.warn("Invalid 'exclude' configuration: must be an array of glob patterns.");
      config.exclude = undefined;
    }

    return config;
  }

  public getFormattedTagName(tagName: string): string {
    return this.config.tagFormatter
      ? this.config.tagFormatter(tagName)
      : tagName;
  }

  private watchConfig() {
    if (this.watcher) return;

    try {
      this.watcher = fs.watch(this.configPath, { persistent: false }, () => {
        this.loadConfig();
        // File watcher in html-plugin will handle restart
      });
    } catch {
      // Config file doesn't exist yet - that's fine
    }
  }

  public onChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index !== -1) this.changeListeners.splice(index, 1);
    };
  }

  private notifyListeners() {
    this.changeListeners.forEach((listener) => listener());
  }

  public dispose() {
    this.watcher?.close();
    this.watcher = undefined;
    this.changeListeners = [];
  }
}

let _singletonConfigService: ConfigurationService | undefined;

export function getConfigurationService(): ConfigurationService {
  if (!_singletonConfigService) {
    _singletonConfigService = new ConfigurationService();
  }
  return _singletonConfigService;
}

export const configurationService = getConfigurationService();
