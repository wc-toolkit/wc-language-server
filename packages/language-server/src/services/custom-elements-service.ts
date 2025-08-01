import * as fs from "fs";
import * as path from "path";
import { ConfigurationService } from "./configuration-service";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import { Component, getAllComponents } from "@wc-toolkit/cem-utilities";
import { getAttributeValueOptions } from "../utilities/cem-utils";

export interface AttributeInfo {
  name: string;
  description?: string;
  type?: string;
  sourcePosition?: number;
}

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

  constructor(
    private workspaceRoot: string,
    private configService?: ConfigurationService
  ) {
    this.initialize();
  }

  private initialize() {
    this.loadManifest();
    this.watchManifest();
    
    // Reload when config changes
    this.configService?.onChange(() => this.loadManifest());
  }

  private loadManifest() {
    this.manifestPath = this.findManifestFile();
    if (!this.manifestPath) return;

    try {
      this.manifestContent = fs.readFileSync(this.manifestPath, "utf8");
      const manifest: cem.Package = JSON.parse(this.manifestContent);
      this.parseManifest(manifest);
      this.notifyChange();
    } catch (error) {
      console.error("Error loading custom elements manifest:", error);
    }
  }

  private findManifestFile(): string | null {
    const paths = [
      "custom-elements.json",
      "dist/custom-elements.json", 
      "src/custom-elements.json",
      "demo/html/custom-elements.json",
      "demos/html/custom-elements.json"
    ].map(p => path.join(this.workspaceRoot, p));

    return paths.find(p => fs.existsSync(p)) || null;
  }

  private parseManifest(manifest: cem.Package) {
    this.customElements.clear();
    this.attributeOptions.clear();
    
    if (!manifest.modules) return;

    const components = getAllComponents(manifest);
    
    components.forEach(element => {
      const tagName = this.configService?.getFormattedTagName(element.tagName!) || element.tagName!;
      this.customElements.set(tagName, element);
      this.setAttributeOptions(tagName, element);
    });
  }

  private setAttributeOptions(tagName: string, component: Component) {
    component.attributes?.forEach(attr => {
      const options = getAttributeValueOptions(attr);
      this.attributeOptions.set(`${tagName}:${attr.name}`, options);
    });
  }

  private watchManifest() {
    if (!this.manifestPath) return;

    try {
      this.manifestWatcher = fs.watchFile(this.manifestPath, () => {
        this.loadManifest();
      });
    } catch (error) {
      console.error("Error watching manifest file:", error);
    }
  }

  private notifyChange() {
    this.changeListeners.forEach(callback => callback());
  }

  // Public API
  public onManifestChange(callback: () => void): () => void {
    this.changeListeners.push(callback);
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index > -1) this.changeListeners.splice(index, 1);
    };
  }

  public getCustomElements(): Component[] {
    return Array.from(this.customElements.values());
  }

  public getCustomElementsMap(): Map<string, Component> {
    return new Map(this.customElements);
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

  public findPositionInManifest(searchText: string): number {
    const position = this.manifestContent.indexOf(searchText);
    return position >= 0 ? position : 0;
  }

  public dispose() {
    this.manifestWatcher?.unref();
    this.changeListeners = [];
  }
}