import { Component } from "@wc-toolkit/cem-utilities";
import { configurationService } from "./configuration-service.js";

export type TagMetadata = {
  label: string;
  description: string;
  insertText: string;
  package: string;
  sortText: string;
  deprecated: boolean;
  deprecationMessage?: string;
};
export type TagCache = Map<string, TagMetadata>;
export type ComponentMetadata = {
  label: string;
  description: string;
  filterText: string;
  sortText: string;
  insertText: string;
  detail: string;
  deprecated: boolean;
  deprecationMessage: string;
};
export type ComponentCache = {
  attributes?: Map<string, ComponentMetadata>;
  attributeValues?: Map<string, ComponentMetadata[]>;
  properties?: Map<string, ComponentMetadata>;
  events?: Map<string, ComponentMetadata>;
  cssVariables?: Map<string, ComponentMetadata>;
  cssParts?: Map<string, ComponentMetadata>;
  cssStates?: Map<string, ComponentMetadata>;
};

export class ComponentService {
  public tagCache: TagCache = new Map();
  public componentCache: Map<string, ComponentCache> = new Map();
  private config = configurationService.config;
  private typeSrc = this.config.typeSrc;
  private loadedCssVars: Map<string, ComponentMetadata> = new Map();
  private loadedCssParts: Map<string, ComponentMetadata> = new Map();
  private loadedCssStates: Map<string, ComponentMetadata> = new Map();

  dispose() {
    this.componentCache.clear();
  }

  loadCache(tagName: string, component: Component, packageName: string) {
    const cache: ComponentCache = {
      attributes: new Map(),
      attributeValues: new Map(),
      properties: new Map(),
      events: new Map(),
      cssVariables: new Map(),
      cssParts: new Map(),
      cssStates: new Map(),
    };
    this.componentCache.set(tagName || "unknown", cache);
    this.loadTagCache(tagName, component, packageName);
    // this.loadAttributeCache(tagName, component);
    // this.loadPropertyCache(tagName, component);
    // this.loadEventCache(tagName, component);
    // this.loadCssVariableCache(tagName, component);
    // this.loadCssPartCache(tagName, component);
    // this.loadCssStateCache(tagName, component);
  }

  private loadTagCache(tagName: string, component: Component, packageName: string) {
    const completion: TagMetadata = {
      label: tagName,
      description: component.summary || "No description available.",
      insertText: tagName,
      package: packageName || "Global",
      sortText: "0" + tagName,
      deprecated: !!component.deprecated,
      deprecationMessage: this.getDeprecatedMessage(
        component.deprecated,
        "This component is deprecated."
      ),
    };
    this.tagCache.set(tagName, completion);
  }

  // private loadAttributeCache(tagName: string, componet: Component) {}

  private getDeprecatedMessage(
    deprecated: string | boolean = false,
    fallbackMessage: string
  ): string {
    return typeof deprecated === "string" ? deprecated : fallbackMessage;
  }
}
