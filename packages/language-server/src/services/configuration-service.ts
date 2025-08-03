import * as path from "path";
import * as fs from "fs";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface WCConfig {
  tagFormatter?: (tagName: string) => string;
  diagnosticSeverity?: {
    invalidBoolean?: DiagnosticSeverity;
    invalidNumber?: DiagnosticSeverity;
    invalidAttributeValue?: DiagnosticSeverity;
    deprecatedAttribute?: DiagnosticSeverity;
    deprecatedElement?: DiagnosticSeverity;
  };
  componentModulePath?: (
    componentName: string,
    tagName: string,
    modulePath: string
  ) => string;
  globalModulePath?: string;
  exclude?: string[];
}

const DEFAULT_CONFIG: WCConfig = {
  diagnosticSeverity: {
    invalidBoolean: "error",
    invalidNumber: "error",
    invalidAttributeValue: "error",
    deprecatedAttribute: "warning",
    deprecatedElement: "warning",
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

  private validateConfig(config: WCConfig): WCConfig {
    const validSeverities: DiagnosticSeverity[] = ["error", "warning", "info", "hint"];
    
    if (config.diagnosticSeverity) {
      const diagnosticKeys = [
        "invalidBoolean",
        "invalidNumber", 
        "invalidAttributeValue",
        "deprecatedAttribute",
        "deprecatedElement"
      ] as const;

      for (const key of diagnosticKeys) {
        if (config.diagnosticSeverity[key] && !validSeverities.includes(config.diagnosticSeverity[key])) {
          console.warn(`Invalid diagnostic severity "${config.diagnosticSeverity[key]}" for ${key}. Using "error" instead.`);
          config.diagnosticSeverity[key] = "error";
        }
      }
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
        // Reload the language server process
        process.exit(0);
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
