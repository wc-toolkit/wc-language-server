import * as path from "path";
import * as fs from "fs";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface WCConfig {
  tagFormatter?: (tagName: string) => string;
  diagnosticSeverity?: {
    invalidBoolean?: DiagnosticSeverity;
    invalidNumber?: DiagnosticSeverity;
    invalidAttributeValue?: DiagnosticSeverity;
  };
  componentModulePath?: (
    componentName: string,
    tagName: string,
    modulePath: string
  ) => string;
  globalModulePath?: string;
  exclude?: string[];
}

export class ConfigurationService {
  public config: WCConfig = {};
  private configPath: string;
  private watcher?: fs.FSWatcher;
  private changeListeners: Array<() => void> = [];

  constructor(private workspaceRoot: string) {
    console.debug("Initializing ConfigurationService for workspace:", workspaceRoot);
    this.configPath = path.join(this.workspaceRoot, "wc.config.js");
    this.loadConfig();
    this.watchConfig();
  }

  loadConfig() {
    try {
      // Use require to synchronously load the config file (clearing cache for reload)
      const absConfigPath = path.resolve(this.configPath);
      delete require.cache[require.resolve(absConfigPath)];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(absConfigPath);
      this.config = mod.default || mod;
    } catch {
      // If file does not exist or fails to load, use empty config
      this.config = {};
    }
    this.notifyChange();
  }

  private watchConfig() {
    if (this.watcher) return;
    try {
      this.watcher = fs.watch(this.configPath, { persistent: false }, () => {
        this.loadConfig();
      });
    } catch {
      // Ignore if file does not exist yet
    }
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const idx = this.changeListeners.indexOf(listener);
      if (idx !== -1) this.changeListeners.splice(idx, 1);
    };
  }

  private notifyChange() {
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  getTagFormatter(): ((tagName: string) => string) | undefined {
    return this.config.tagFormatter;
  }

  getDiagnosticSeverity(): WCConfig["diagnosticSeverity"] {
    return this.config.diagnosticSeverity;
  }

  getComponentModulePath():
    | ((componentName: string, tagName: string, modulePath: string) => string)
    | undefined {
    return this.config.componentModulePath;
  }

  getGlobalModulePath(): string | undefined {
    return this.config.globalModulePath;
  }

  getExclude(): string[] | undefined {
    return this.config.exclude;
  }

  dispose() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    this.changeListeners = [];
  }
}
