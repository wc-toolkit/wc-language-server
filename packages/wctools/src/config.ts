// Import and re-export the consolidated shared configuration from language server
import {
  WCConfig,
  LibraryConfig,
  DiagnosticSeverity,
  DiagnosticSeverityOptions,
  DEFAULT_CONFIG,
  loadConfig as sharedLoadConfig,
  findConfigFile,
  loadConfigFile,
  BaseConfigurationManager,
} from "../../language-server/src/services/index.js";
import fs from "fs";

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

export function validateConfig(config: WCConfig): string[] {
  const manager = new BaseConfigurationManager();
  return manager.getConfigValidationErrors(config);
}

/**
 * Creates a sample configuration file in JavaScript format
 */
export async function createConfigFile(
  filePath: string = "wc.config.mjs"
): Promise<void> {
  const sampleConfig: Partial<WCConfig> = {
    manifestSrc: "custom-elements.json",
    include: ["src/**/*.html", "src/**/*.js", "src/**/*.ts"],
    exclude: ["node_modules/**", "dist/**", "build/**"],
    ...DEFAULT_CONFIG,
  };

  let type = "module";

  if (fs.existsSync('./package.json')) {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    type = pkg.type !== 'module' ? 'commonjs' : 'module';
    filePath = type === "module" ? "wc.config.mjs" : "wc.config.js";
  }

  // Create JavaScript module format instead of JSON
  const content =
    type === "module"
      ? `/** @type {import('@wc-toolkit/wctools').WCConfig} */
export default ${JSON.stringify(sampleConfig, null, 2)};
`
      : `/** @type {import('@wc-toolkit/wctools').WCConfig} */
module.exports = ${JSON.stringify(sampleConfig, null, 2)};
`;

  await fs.promises.writeFile(filePath, content, "utf-8");
}
