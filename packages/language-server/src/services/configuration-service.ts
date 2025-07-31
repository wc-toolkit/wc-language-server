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
      this.config = mod.default || mod || {};
    } catch {
      this.config = {};
    }
    this.notifyListeners();
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
