import * as path from "path";
import * as fs from "fs";
import {
  BaseConfigurationManager,
  DEFAULT_CONFIG,
  loadConfig as loadConfigFileOrDir,
  WCConfig,
} from "./shared-configuration.js";
import { setEnableDebugging, warn, debug } from "../utilities/logger.js";

export type {
  WCConfig,
  DiagnosticSeverity,
  LibraryConfig,
  DiagnosticSeverityOptions,
} from "./shared-configuration.js";

export class ConfigurationService extends BaseConfigurationManager {
  private workspaceRoot: string = process.cwd();

  constructor() {
    super();
    void this.loadConfig();
  }

  public setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
    debug("config:workspace:set", { workspaceRoot: root });
  }

  public async loadConfig(): Promise<void> {
    try {
      debug("config:load:start", { workspaceRoot: this.workspaceRoot });
      const configPath = path.join(this.workspaceRoot, "wc.config.js");
      // If an explicit config file exists at configPath, load that file directly.
      if (fs.existsSync(configPath)) {
        debug("config:load:explicitFound", { path: configPath });
        const userConfig = await loadConfigFileOrDir(
          configPath,
          this.workspaceRoot
        );

        const validated = this.validateConfig(userConfig || {});
        this.config = this.mergeWithDefaults(validated as WCConfig);
        debug("config:load:explicitMerged", {
          debug: this.config.debug,
          include: this.config.include,
          exclude: this.config.exclude,
          manifestSrc: this.config.manifestSrc,
        });
      } else {
        debug("config:load:search");
        // Otherwise, allow loader to search for config files within the workspace root
        const userConfig = (await loadConfigFileOrDir(
          undefined,
          this.workspaceRoot
        )) as Partial<WCConfig> | undefined;
        this.config = this.mergeWithDefaults(
          this.validateConfig(userConfig || {})
        );
        debug("config:load:searchMerged", {
          debug: this.config.debug,
          include: this.config.include,
          exclude: this.config.exclude,
          manifestSrc: this.config.manifestSrc,
        });
      }
    } catch (e) {
      warn("Failed to load config, using default:", e);
      this.config = DEFAULT_CONFIG;
      debug("config:load:defaultApplied");
    }

    setEnableDebugging(!!this.config.debug);
    debug("config:debug:enabled", { enabled: !!this.config.debug });
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
