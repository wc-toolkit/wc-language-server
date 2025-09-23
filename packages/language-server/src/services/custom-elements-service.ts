/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import { configurationService } from "./configuration-service.js";
import { debug, warn, error } from "../utilities/logger.js";
import type * as cem from "custom-elements-manifest/schema.js";
import {
  Component,
  getAllComponents,
  getComponentDetailsTemplate,
  getComponentEventsWithType,
  getPropertyOnlyFields,
} from "@wc-toolkit/cem-utilities";
import { parseAttributeValueOptions } from "../utilities/cem-utils.js";
import { readFileSync } from "fs";

export type AttributeInfo = {
  name: string;
  description?: string;
  deprecated?: boolean | string;
  type?: string;
  options?: string[];
  sourcePosition?: number;
  sortText?: string;
  priority?: number;
};

export type AttributeKey = `${string}:${string}`;
export type AttributeTypes = Map<AttributeKey, string[] | string>;

/**
 * Simplified service for managing custom elements manifest data.
 * Handles loading, parsing, and providing access to custom element definitions.
 */
export class CustomElementsService {
  private customElementsDocs = new Map<string, string>();
  private customElements = new Map<string, Component>();
  private manifestPath: string | null = null;
  private manifestContent = "";
  private attributeOptions: AttributeTypes = new Map();
  private workspaceRoot: string = "";
  private dependencyCustomElements = new Map<string, Component>();
  private packageJsonPath: string = "";
  // private dependencies: string[] = [];

  public attributeData: Map<AttributeKey, AttributeInfo> = new Map();

  constructor() {
    this.loadManifests();
  }

  public setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
    debug("Setting workspace root to:", root);
    this.loadManifests();
  }

  public getAllDocs(): Map<string, string> {
    return this.customElementsDocs;
  }

  public getCustomElementDocs(tagName: string): string {
    return this.customElementsDocs.get(tagName) || "";
  }

  private loadGlobalManifest() {
    const cemPath = configurationService.config?.manifestSrc;
    const { isUrl } = this.isPathOrUrl(cemPath);

    try {
      if (isUrl) {
        this.loadManifestFromUrl(cemPath!);
      } else {
        this.loadManifestFromFile(this.workspaceRoot, cemPath);
      }
    } catch (err) {
      error("Error loading custom elements manifest:", err);
    }
  }

  private parseManifest(manifest: cem.Package, depName?: string) {
    if (!manifest.modules) return;

    const components = getAllComponents(manifest);

    components.forEach((element) => {
      if (depName) {
        element.dependency = depName;
      }

      const tagName =
        configurationService?.getFormattedTagName(
          element.tagName!,
          element.dependency as string
        ) || element.tagName!;
      this.customElements.set(tagName, element);
      this.customElementsDocs.set(
        tagName,
        `### \`<${tagName}>\`\n\n---\n\n${getComponentDetailsTemplate(element)}`
      );
      this.setAttributeOptions(tagName, element, depName);
    });
  }

  private setAttributeOptions(
    tagName: string,
    component: Component,
    depName?: string
  ) {
    component.attributes?.forEach((attr) => {
      const typeSrc =
        configurationService.config.libraries?.[`${depName}`]?.typeSrc ||
        configurationService.config.typeSrc;
      const options = parseAttributeValueOptions(attr, typeSrc);
      this.attributeOptions.set(`${tagName}:${attr.name}`, options);
      this.attributeData.set(`${tagName}:${attr.name}`, {
        name: attr.name,
        description: attr.description,
        deprecated: attr.deprecated,
        type: Array.isArray(options) ? options.join(" | ") : options,
        options: Array.isArray(options) ? options : undefined,
        sortText: `00${attr.name}`, // Standard attributes first
        priority: 1,
      });
    });

    this.addLibraryBindings(component, tagName);
    console.debug(this.attributeData);
  }

  private addLibraryBindings(
    component: Component,
    tagName: string,
    depName?: string
  ) {
    // const frameworks = configurationService.config.frameworks;
    // console.debug("Adding library bindings for:", JSON.stringify(frameworks));
    // if (frameworks?.includes("lit") || this.dependencies.includes("lit")) {
    const props = getPropertyOnlyFields(component);
    for (const prop of props) {
      const typeSrc =
        configurationService.config.libraries?.[`${depName}`]?.typeSrc ||
        configurationService.config.typeSrc;

      this.attributeData.set(`${tagName}:.${prop.name}`, {
        name: `.${prop.name}`,
        description: prop.description,
        deprecated: prop.deprecated,
        type: (prop as any)?.[typeSrc || "type"]?.text,
        sortText: `01.${prop.name}`, // Properties second
        priority: 2,
      });
    }

    const events = getComponentEventsWithType(component);
    for (const event of events) {
      this.attributeData.set(`${tagName}:@${event.name}`, {
        name: `@${event.name}`,
        description: event.description,
        deprecated: event.deprecated,
        type: event.type?.text || "Event",
        sortText: `02@${event.name}`, // Events third
        priority: 3,
      });
    }
    // }
  }

  /**
   * Get sorted attributes for a custom element
   */
  public getSortedAttributes(tagName: string): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];

    for (const [key, attr] of this.attributeData.entries()) {
      if (key.startsWith(`${tagName}:`)) {
        attributes.push(attr);
      }
    }

    // Sort by priority first, then by sortText
    return attributes.sort((a, b) => {
      if (a.priority !== b.priority) {
        return (a.priority || 99) - (b.priority || 99);
      }
      return (a.sortText || a.name).localeCompare(b.sortText || b.name);
    });
  }

  public getCustomElements(): Component[] {
    // Merge local and dependency custom elements
    const all = new Map<string, Component>([
      ...this.dependencyCustomElements,
      ...this.customElements,
    ]);
    return Array.from(all.values());
  }

  public hasCustomElement(tagName: string): boolean {
    return this.customElements.has(tagName);
  }

  public getCustomElement(tagName: string): Component | null {
    return this.customElements.get(tagName) || null;
  }

  public getManifestPath(): string | null {
    return this.manifestPath;
  }

  public getAttributeValueOptions(
    tagName: string,
    attributeName: string
  ): string[] | string | null {
    const options = this.attributeOptions.get(`${tagName}:${attributeName}`);
    return options || null;
  }

  public getAttributeInfo(
    tagName: string,
    attributeName: string
  ): AttributeInfo | null {
    return this.attributeData.get(`${tagName}:${attributeName}`) || null;
  }

  public findPositionInManifest(searchText: string): number {
    const position = this.manifestContent.indexOf(searchText);
    return position >= 0 ? position : 0;
  }

  public dispose() {
    this.customElements.clear();
    this.customElementsDocs.clear();
  }

  private loadManifests() {
    this.packageJsonPath = path.join(this.workspaceRoot, "package.json");
    try {
      this.loadGlobalManifest();
      this.loadConfigManifests();
      this.loadDependencyManifests();
    } catch (error) {
      void error;
    }
  }

  private loadConfigManifests() {
    if (configurationService.config.manifestSrc) {
      this.loadManifestFromFile(
        this.workspaceRoot,
        configurationService.config.manifestSrc
      );
    }

    const libraryConfigs = configurationService.config.libraries;
    if (!libraryConfigs) {
      return;
    }

    for (const [name, libConfig] of Object.entries(libraryConfigs)) {
      if (!libConfig.manifestSrc) {
        continue;
      }

      const { isUrl, isFilePath } = this.isPathOrUrl(libConfig.manifestSrc);
      if (isUrl) {
        this.loadManifestFromUrl(libConfig.manifestSrc, name);
      } else if (isFilePath) {
        // For file paths, pass the workspace root as the base path for relative paths
        const basePath = path.isAbsolute(libConfig.manifestSrc)
          ? path.dirname(libConfig.manifestSrc)
          : this.workspaceRoot;
        this.loadManifestFromFile(basePath, libConfig.manifestSrc, name);
      } else {
        // If it's not a URL or file path, treat it as a relative path from workspace root
        this.loadManifestFromFile(
          this.workspaceRoot,
          libConfig.manifestSrc,
          name
        );
      }
    }
  }

  private loadDependencyManifests() {
    if (!fs.existsSync(this.packageJsonPath)) {
      return;
    }

    const packageJson =
      JSON.parse(readFileSync(this.packageJsonPath, "utf8")) || {};
    const dependencies = packageJson.dependencies || {};
    // this.dependencies = [
    //   ...Object.keys(dependencies),
    //   ...Object.keys(packageJson.devDependencies || {}),
    // ];

    // Check if node_modules directory exists
    const nodeModulesPath = path.join(this.workspaceRoot, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
      error(
        "`node_modules` directory was not found. Please make sure your dependencies are installed."
      );
      return;
    }

    for (const depName of Object.keys(dependencies)) {
      try {
        // Check if dependency directory exists in node_modules
        const depRoot = path.join(this.workspaceRoot, "node_modules", depName);
        if (!fs.existsSync(depRoot)) {
          error(`Dependency directory not found: ${depRoot}`);
          continue;
        }

        // Try to resolve the dependency's package root
        const depPkgPath = path.join(depRoot, "package.json");

        // Read the dependency's package.json only if it exists
        let depPkg: Record<string, unknown> = {};
        if (fs.existsSync(depPkgPath)) {
          try {
            depPkg = JSON.parse(readFileSync(depPkgPath, "utf8")) as Record<
              string,
              unknown
            >;
          } catch (err) {
            error(`Error reading package.json from ${depPkgPath}:`, err as any);
            continue;
          }
        } else {
          error(`Package.json not found for dependency: ${depPkgPath}`);
        }

        this.loadManifestFromFile(
          depRoot,
          (depPkg as any).customElements,
          depName
        );
      } catch (err) {
        error(`Error loading CEM for dependency ${depName}:`, err as any);
      }
    }
  }

  private loadManifestFromFile(
    packagePath: string,
    cemPath?: string,
    depName?: string
  ) {
    // Check if the package path exists first
    if (packagePath && !fs.existsSync(packagePath)) {
      debug(`Package path does not exist: ${packagePath}`);
      return;
    }

    let fullPath = "";

    if (cemPath) {
      // If a custom path is provided, resolve it relative to the package path
      fullPath = path.isAbsolute(cemPath)
        ? cemPath
        : path.join(packagePath, cemPath);

      if (!fs.existsSync(fullPath)) {
        debug(`Custom manifest path does not exist: ${fullPath}`);
        fullPath = ""; // Reset to try default paths
      }
    }

    // Check default paths if custom-elements.json is not found or cemPath wasn't provided
    if (!fullPath) {
      const defaultPaths = [
        path.join(packagePath, "custom-elements.json"),
        path.join(packagePath, "dist/custom-elements.json"),
      ];

      fullPath = defaultPaths.find((p) => fs.existsSync(p)) || "";
    }

    if (!fullPath) {
      debug(`No custom elements manifest found for package: ${packagePath}`);
      return;
    }

    try {
      const manifestContent = readFileSync(fullPath, "utf8");
      const manifest = JSON.parse(manifestContent);

      if (manifest) {
        debug(
          `Loading manifest from: ${fullPath}${depName ? ` for dependency: ${depName}` : ""}`
        );
        this.parseManifest(manifest, depName);
      } else {
        warn(`Manifest file is empty or invalid: ${fullPath}`);
      }
    } catch (err) {
      error(`Error reading or parsing manifest file ${fullPath}:`, err as any);
    }
  }

  private loadManifestFromUrl(url: string, depName?: string) {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}`);
        }
        return response
          .json()
          .then((manifest) => this.parseManifest(manifest, depName));
      })
      .catch((err) => {
        error(`Error loading manifest from ${url}:`, err as any);
      });
  }

  private isPathOrUrl(str?: string): { isUrl: boolean; isFilePath: boolean } {
    if (!str || typeof str !== "string") {
      return { isUrl: false, isFilePath: false };
    }

    // URL detection
    const urlRegex = /^(https?:\/\/|www\.|ftp:\/\/|file:\/\/)/i;
    const isUrl = urlRegex.test(str.trim());

    // File path detection - common patterns for different OS
    const unixPathRegex = /^(\/[\w-]+(\/[\w-. ]+)+|\/[\w-. ]+)$/;
    const windowsPathRegex =
      /^([a-zA-Z]:\\|\\\\)([\w-]+(\\[\w-. ]+)+|[\w-. ]+)$/;
    const relativePathRegex = /^\.{1,2}\/[\w-]+(\/[\w-. ]+)*$/;

    const isFilePath =
      unixPathRegex.test(str.trim()) ||
      windowsPathRegex.test(str.trim()) ||
      relativePathRegex.test(str.trim());

    return { isUrl, isFilePath };
  }
}

let _singletonCustomElementsService: CustomElementsService | undefined;

export function getCustomElementsService(): CustomElementsService {
  if (!_singletonCustomElementsService) {
    _singletonCustomElementsService = new CustomElementsService();
  }
  return _singletonCustomElementsService;
}

export const customElementsService = getCustomElementsService();
