// Import and re-export the consolidated shared configuration from language server
import {
  WCConfig,
  LibraryConfig,
  DiagnosticSeverity,
  DiagnosticSeverityOptions,
  DEFAULT_CONFIG,
  loadConfig as sharedLoadConfig,
  createConfigFile as sharedCreateConfigFile,
  findConfigFile,
  loadConfigFile,
  BaseConfigurationManager,
} from "@wc-toolkit/language-server/services";

// Re-export all the shared types and constants
export type {
  WCConfig,
  LibraryConfig,
  DiagnosticSeverity,
  DiagnosticSeverityOptions,
};
export { DEFAULT_CONFIG, findConfigFile, loadConfigFile };

// Export utility functions that use the shared logic
export async function loadConfig(configPath?: string): Promise<WCConfig> {
  return sharedLoadConfig(configPath);
}

export async function createConfigFile(
  configPath: string = "wc.config.js",
): Promise<void> {
  return sharedCreateConfigFile(configPath);
}

export function validateConfig(config: WCConfig): string[] {
  const manager = new BaseConfigurationManager();
  return manager.getConfigValidationErrors(config);
}
