/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import { configurationService } from "./configuration-service";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import { Component, getAllComponents } from "@wc-toolkit/cem-utilities";
import { getAttributeValueOptions } from "../utilities/cem-utils";
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

  private loadLocalManifest(cemPath?: string, depName?: string) {
    try {
      this.loadManifest(this.workspaceRoot, cemPath, depName);
      this.notifyChange();
    } catch (error) {
      console.error("Error loading custom elements manifest:", error);
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
        configurationService?.getFormattedTagName(element.tagName!, element.dependency as string) ||
        element.tagName!;
      this.customElements.set(tagName, element);
      this.setAttributeOptions(tagName, element);
    });
  }

  private setAttributeOptions(tagName: string, component: Component) {
    component.attributes?.forEach((attr) => {
      const options = getAttributeValueOptions(attr);
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
        this.loadLocalManifest();
      });
    } catch (error) {
      console.error("Error watching manifest file:", error);
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

  public getCustomElementsMap(): Map<string, Component> {
    // Merge local and dependency custom elements
    return new Map([...this.dependencyCustomElements, ...this.customElements]);
  }

  public getAttributeOptions(): AttributeTypes {
    return new Map(this.attributeOptions);
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

  private loadManifests() {
    this.dependencyCustomElements.clear();
    this.packageJsonPath = path.join(this.workspaceRoot, "package.json");
    let dependencies: Record<string, string> = {};
    let packageJson: any;
    try {
      packageJson = JSON.parse(readFileSync(this.packageJsonPath, "utf8"));
    } catch (error) {
      console.error("Error reading package.json:", error);
    }
    
    this.loadLocalManifest(packageJson?.customElements);
    dependencies = packageJson?.dependencies || {};

    for (const depName of Object.keys(dependencies)) {
      try {
        // Try to resolve the dependency's package root
        const depPkgPath = path.join("node_modules", depName, "package.json");
        const depRoot = path.join("node_modules", depName);

        // Read the dependency's package.json
        let depPkg: any = {};
        try {
          depPkg = JSON.parse(readFileSync(depPkgPath, "utf8"));
        } catch (error) {
          console.error(
            `Error reading package.json from ${depPkgPath}:`,
            error
          );
        }

        this.loadManifest(depRoot, depPkg.customElements, depName);
      } catch (error) {
        console.error(`Error loading CEM for dependency ${depName}:`, error);
      }
    }
  }

  private loadManifest(packagePath: string, cemPath?: string, depName?: string) {
    let fullPath = path.join(path.dirname(packagePath), cemPath || "");

    console.debug(`Loading CEM from ${fullPath}`);

    // Check default paths if custom-elements.json is not found
    if (!cemPath || !fs.existsSync(fullPath)) {
      fullPath =
        [
          path.join(packagePath, "custom-elements.json"),
          path.join(packagePath, "dist/custom-elements.json"),
        ].find((p) => fs.existsSync(p)) || "";
    }
    const manifest = JSON.parse(readFileSync(fullPath, "utf8"));
    if (manifest) {
      this.parseManifest(manifest, depName);
    }
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
    } catch (error) {
      console.error("Error watching package.json file:", error);
    }
  }

  public dispose() {
    this.manifestWatcher?.unref();
    this.packageJsonWatcher?.close();
    this.changeListeners = [];
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
