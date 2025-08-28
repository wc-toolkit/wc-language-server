/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import { configurationService } from "./configuration-service.js";
import { debug, warn, error } from "../utilities/logger.js";
import type * as cem from "custom-elements-manifest/schema.js";
import { Component, getAllComponents } from "@wc-toolkit/cem-utilities";
import { parseAttributeValueOptions } from "../utilities/cem-utils.js";
import { readFileSync } from "fs";

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
export class CustomElementsService {
  private customElements = new Map<string, Component>();
  private manifestWatcher?: fs.StatWatcher;
  private manifestPath: string | null = null;
  private manifestContent = "";
  private attributeOptions: AttributeTypes = new Map();
  private changeListeners: (() => void)[] = [];
  private workspaceRoot: string = "";
  private dependencyCustomElements = new Map<string, Component>();
  private packageJsonPath: string = "";
  private packageJsonWatcher?: fs.FSWatcher;

  public attributeData: Map<AttributeKey, AttributeInfo> = new Map();

  constructor() {
    this.initialize();
  }

  public setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root;
    debug("Setting workspace root to:", root);
    this.reLoadManifests();
  }

  private initialize() {
    this.loadManifests();
    this.watchManifest();
    this.watchPackageJson();

    // Reload when config changes
    configurationService?.onChange(() => {
      this.reLoadManifests();
    });
  }

  private reLoadManifests() {
    this.customElements.clear();
    this.attributeOptions.clear();

    this.loadManifests();
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
      this.notifyChange();
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
      });
    });
  }

  private watchManifest() {
    if (!this.manifestPath) return;

    try {
      this.manifestWatcher = fs.watchFile(this.manifestPath, () => {
        this.loadGlobalManifest();
      });
    } catch (err) {
      error("Error watching manifest file:", err);
    }
  }

  private notifyChange() {
    this.changeListeners.forEach((callback) => callback());
  }

  public onManifestChange(callback: () => void): () => void {
    this.changeListeners.push(callback);
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index > -1) this.changeListeners.splice(index, 1);
    };
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
    this.manifestWatcher?.unref();
    this.packageJsonWatcher?.close();
    this.changeListeners = [];
  }

  private loadManifests() {
    this.dependencyCustomElements.clear();
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
        this.loadManifestFromFile(libConfig.manifestSrc, undefined, name);
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

    for (const depName of Object.keys(dependencies)) {
      try {
        // Try to resolve the dependency's package root
        const depPkgPath = path.join("node_modules", depName, "package.json");
        const depRoot = path.join("node_modules", depName);

        // Read the dependency's package.json
        let depPkg: Record<string, unknown> = {};
        try {
          depPkg = JSON.parse(readFileSync(depPkgPath, "utf8")) as Record<
            string,
            unknown
          >;
        } catch (err) {
          warn(`Error reading package.json from ${depPkgPath}:`, err as any);
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
    let fullPath = path.join(path.dirname(packagePath), cemPath || "");

    // Check default paths if custom-elements.json is not found
    if (!cemPath || !fs.existsSync(fullPath)) {
      fullPath =
        [
          path.join(packagePath, "custom-elements.json"),
          path.join(packagePath, "dist/custom-elements.json"),
        ].find((p) => fs.existsSync(p)) || "";
    }
    if (fullPath) {
      const manifest = JSON.parse(readFileSync(fullPath, "utf8"));
      if (manifest) {
        this.parseManifest(manifest, depName);
      }
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

  private watchPackageJson() {
    if (!this.packageJsonPath) {
      this.packageJsonPath = path.join(this.workspaceRoot, "package.json");
    }
    if (!fs.existsSync(this.packageJsonPath)) return;
    if (this.packageJsonWatcher) return;

    try {
      this.packageJsonWatcher = fs.watch(
        this.packageJsonPath,
        { persistent: false },
        () => {
          this.loadManifests();
          this.notifyChange();
        }
      );
    } catch (err) {
      error("Error watching package.json file:", err as any);
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

let _singletonCustomElementsService: CustomElementsService | undefined;

export function getCustomElementsService(): CustomElementsService {
  if (!_singletonCustomElementsService) {
    _singletonCustomElementsService = new CustomElementsService();
  }
  return _singletonCustomElementsService;
}

export const customElementsService = getCustomElementsService();
