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
} from "@wc-toolkit/cem-utilities";
import { parseAttributeValueOptions } from "../utilities/cem-utils.js";
import { readFileSync } from "fs";
import { autocompleteService } from "./autocomplete-service.js";


export type AttributeInfo = {
  name: string;
  description?: string;
  deprecated?: boolean | string;
  type?: string;
  options?: string[];
  sourcePosition?: number;
};

export type AttributeKey = `${string}:${string}`;
export type AttributeTypes = Map<AttributeKey, string[] | string>;

/**
 * Simplified service for managing custom elements manifest data.
 * Handles loading, parsing, and providing access to custom element definitions.
 */
export class ManifestService {
  private customElementsDocs = new Map<string, string>();
  private customElements = new Map<string, Component>();
  private manifestPath: string | null = null;
  private manifestContent = "";
  private attributeOptions: AttributeTypes = new Map();
  private workspaceRoot: string = process.cwd();
  private dependencyCustomElements = new Map<string, Component>();
  private packageJsonPath: string = "";
  private manifestsLoadedPromise: Promise<void> | null = null;

  public attributeData: Map<AttributeKey, AttributeInfo> = new Map();

  constructor() {
    debug("cem:init");
    this.manifestsLoadedPromise = configurationService.loadConfig()
      .then(() => this.loadManifests())
      .catch((err) => {
        error("cem:init:failed", err);
      });
  }

  /**
   * Wait for all manifests (including external URLs) to finish loading.
   * Call this before performing validation to ensure all custom elements are available.
   */
  public async waitForManifestsLoaded(): Promise<void> {
    if (this.manifestsLoadedPromise) {
      await this.manifestsLoadedPromise;
    }
  }

  public getAllDocs(): Map<string, string> {
    return this.customElementsDocs;
  }

  public getCustomElementDocs(tagName: string): string {
    return this.customElementsDocs.get(tagName) || "";
  }

  private async loadGlobalManifest(): Promise<void> {
    const cemPath = configurationService.config?.manifestSrc;
    const { isUrl } = this.isPathOrUrl(cemPath);

    try {
      debug("cem:global:start", { manifestSrc: cemPath });
      if (isUrl) {
        await this.loadManifestFromUrl(cemPath!);
      } else {
        this.loadManifestFromFile(this.workspaceRoot, cemPath);
      }
      debug("cem:global:done", { elements: this.customElements.size });
    } catch (err) {
      error("Error loading custom elements manifest:", err);
    }
  }

  private parseManifest(manifest: cem.Package, depName?: string) {
    if (!manifest.modules) return;

    const components = getAllComponents(manifest);
    const altType = configurationService.config.typeSrc;

    debug("cem:parse:start", {
      dep: depName || "local",
      components: components.length,
    });
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
        `### \`<${tagName}>\`\n\n---\n\n${getComponentDetailsTemplate(element, { altType })}`
      );
      this.setAttributeOptions(tagName, element, depName);
      autocompleteService.loadCache(tagName, element);
    });
    debug("cem:parse:complete", {
      dep: depName || "local",
      totalElements:
        this.customElements.size + this.dependencyCustomElements.size,
      attributesIndexed: this.attributeData.size,
    });
  }

  private setAttributeOptions(
    tagName: string,
    component: Component,
    depName?: string
  ) {
    let added = 0;
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
      });
      added++;
    });
    debug("cem:attributes:set", {
      tag: tagName,
      dep: depName || "local",
      added,
      totalAttributeEntries: this.attributeData.size,
    });
  }

  public getCustomElements(): Component[] {
    const all = new Map<string, Component>([
      ...this.dependencyCustomElements,
      ...this.customElements,
    ]);
    const arr = Array.from(all.values());
    debug("cem:getCustomElements", { count: arr.length });
    return arr;
  }

  public hasCustomElement(tagName: string): boolean {
    return this.customElements.has(tagName);
  }

  public getCustomElement(tagName: string): Component | null {
    const hit = this.customElements.get(tagName) || null;
    debug("cem:getCustomElement", { tag: tagName, hit: !!hit });
    return hit;
  }

  public getManifestPath(): string | null {
    return this.manifestPath;
  }

  public getAttributeValueOptions(
    tagName: string,
    attributeName: string
  ): string[] | string | null {
    const options = this.attributeOptions.get(`${tagName}:${attributeName}`);
    debug("cem:getAttributeValueOptions", {
      tag: tagName,
      attr: attributeName,
      found: options != null,
      type: Array.isArray(options) ? "enum" : typeof options,
    });
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
    debug("cem:dispose");
    this.customElements.clear();
    this.customElementsDocs.clear();
    this.dependencyCustomElements.clear();
    this.attributeOptions.clear();
    this.attributeData.clear();
    this.manifestPath = null;
    this.manifestContent = "";
    autocompleteService.dispose();
  }

  public async reload(): Promise<void> {
    debug("cem:reload:start");
    this.dispose();
    this.manifestsLoadedPromise = this.loadManifests();
    await this.manifestsLoadedPromise;
    debug("cem:reload:complete", {
      localElements: this.customElements.size,
      dependencyElements: this.dependencyCustomElements.size,
    });
  }

  private async loadManifests(): Promise<void> {
    debug("cem:load:start");
    this.packageJsonPath = path.join(this.workspaceRoot, "package.json");
    try {
      await this.loadGlobalManifest();
      await this.loadConfigManifests();
      this.loadDependencyManifests();
      debug("cem:load:complete", {
        localElements: this.customElements.size,
        dependencyElements: this.dependencyCustomElements.size,
        totalElements:
          this.customElements.size + this.dependencyCustomElements.size,
        attributes: this.attributeData.size,
      });
    } catch (error) {
      debug("cem:load:error", error);
      void error;
    }
  }

  private async loadConfigManifests(): Promise<void> {
    debug("cem:config:start");
    if (configurationService.config.manifestSrc) {
      debug("cem:config:primary", {
        src: configurationService.config.manifestSrc,
      });
      this.loadManifestFromFile(
        this.workspaceRoot,
        configurationService.config.manifestSrc
      );
    } else {
      debug("cem:config:primary:none");
    }

    const libraryConfigs = configurationService.config.libraries;
    if (!libraryConfigs) {
      return;
    }

    const promises: Promise<void>[] = [];
    for (const [name, libConfig] of Object.entries(libraryConfigs)) {
      debug("cem:config:library", {
        library: name,
        manifestSrc: libConfig.manifestSrc,
      });
      if (!libConfig.manifestSrc) {
        continue;
      }

      const { isUrl, isFilePath } = this.isPathOrUrl(libConfig.manifestSrc);
      if (isUrl) {
        promises.push(this.loadManifestFromUrl(libConfig.manifestSrc, name));
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
    await Promise.all(promises);
    debug("cem:config:done");
  }

  private loadDependencyManifests() {
    debug("cem:deps:start");
    if (!fs.existsSync(this.packageJsonPath)) {
      debug("cem:deps:packageJsonMissing", { path: this.packageJsonPath });
      return;
    }

    const packageJson =
      JSON.parse(readFileSync(this.packageJsonPath, "utf8")) || {};
    const dependencies = packageJson.dependencies || {};

    // Check if node_modules directory exists
    const nodeModulesPath = path.join(this.workspaceRoot, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
      error(
        "`node_modules` directory was not found. Please make sure your dependencies are installed."
      );
      return;
    }

    for (const depName of Object.keys(dependencies)) {
      debug("cem:dep:scan", { dep: depName });
      try {
        // Check if dependency directory exists in node_modules
        const depRoot = path.join(this.workspaceRoot, "node_modules", depName);
        if (!fs.existsSync(depRoot)) {
          debug("cem:dep:missingDir", { dep: depName });
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
          debug("cem:dep:missingPackageJson", { dep: depName });
        }

        this.loadManifestFromFile(
          depRoot,
          (depPkg as any).customElements,
          depName
        );
      } catch (err) {
        debug("cem:dep:error", {
          dep: depName,
          message: (err as any)?.message,
        });
        error(`Error loading CEM for dependency ${depName}:`, err as any);
      }
    }
    debug("cem:deps:complete", {
      dependencyElements: this.dependencyCustomElements.size,
      totalElements:
        this.customElements.size + this.dependencyCustomElements.size,
    });
  }

  private loadManifestFromFile(
    packagePath: string,
    cemPath?: string,
    depName?: string
  ) {
    debug("cem:file:resolve:start", {
      packagePath,
      cemPath,
      dep: depName || "local",
    });

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
        debug("cem:file:customNotFound", { attempted: fullPath });
        fullPath = ""; // Reset to try default paths
      }
    }

    // Check default paths if custom-elements.json is not found or cemPath wasn't provided
    if (!fullPath) {
      debug("cem:file:defaultSearch");
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
    debug("cem:file:resolved", { fullPath, dep: depName || "local" });
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

  private async loadManifestFromUrl(url: string, depName?: string): Promise<void> {
    debug("cem:url:fetch", { url, dep: depName || "local" });
    try {
      const response = await fetch(url);
      if (!response.ok) {
        debug("cem:url:fetchFailed", { url, status: response.status });
        throw new Error(`Failed to fetch ${url}`);
      }
      const manifest = await response.json();
      debug("cem:url:fetched", { url, dep: depName || "local" });
      this.parseManifest(manifest, depName);
    } catch (err) {
      error(`Error loading manifest from ${url}:`, err as any);
    }
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

let _singletonManifestService: ManifestService | undefined;

export function getManifestService(): ManifestService {
  if (!_singletonManifestService) {
    _singletonManifestService = new ManifestService();
  }
  return _singletonManifestService;
}

export const manifestService = getManifestService();
