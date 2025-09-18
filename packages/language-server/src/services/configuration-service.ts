import * as path from "path";
import * as fs from "fs";
import {
  BaseConfigurationManager,
  DEFAULT_CONFIG,
  loadConfig as loadConfigFileOrDir,
  WCConfig,
} from "./shared-configuration.js";
import { warn } from "../utilities/logger.js";

export type {
  WCConfig,
  DiagnosticSeverity,
  LibraryConfig,
  DiagnosticSeverityOptions,
} from "./shared-configuration.js";

export class ConfigurationService extends BaseConfigurationManager {
  private configPath: string;
  private workspaceRoot: string = "";

  constructor() {
    super();
    this.configPath = path.join(this.workspaceRoot, "wc.config.js");
    this.initialize();
  }

  private initialize() {
    // Start async load (do not await here to preserve constructor sync behaviour)
    // The loader is ESM-friendly and will load JS/TS/JSON via dynamic import or JSON parse.
    // Consumers should listen to config change events if they require the final config.
    // Fire-and-forget keeps compatibility with earlier synchronous behaviour.
    void this.loadConfig();
  }

  public async loadConfig(): Promise<void> {
    try {
      // If an explicit config file exists at configPath, load that file directly.
      if (fs.existsSync(this.configPath)) {
        const userConfig = (await loadConfigFileOrDir(
          this.configPath,
          this.workspaceRoot,
        )) as Partial<WCConfig> | undefined;
        const validated = this.validateConfig(userConfig || {});
        this.config = this.mergeWithDefaults(validated as WCConfig);
      } else {
        // Otherwise, allow loader to search for config files within the workspace root
        const userConfig = (await loadConfigFileOrDir(
          undefined,
          this.workspaceRoot || process.cwd(),
        )) as Partial<WCConfig> | undefined;
        this.config = this.mergeWithDefaults(
          this.validateConfig(userConfig || {}),
        );
      }
    } catch (e) {
      // If loading fails for any reason, fall back to defaults but keep service alive.
      warn("Failed to load config, using default:", e);
      this.config = DEFAULT_CONFIG;
    }
    this.notifyListeners();
  }

  public setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
    this.configPath = path.join(this.workspaceRoot, "wc.config.js");
    this.initialize();
  }

  public dispose(): void {
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
