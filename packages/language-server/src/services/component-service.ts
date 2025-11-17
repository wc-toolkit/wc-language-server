import {
  Component,
  getComponentPublicProperties,
} from "@wc-toolkit/cem-utilities";
import { configurationService } from "./configuration-service.js";
import { parseAttributeValueOptions } from "../utilities/cem-utils.js";
import {
  getAttributePrefix,
  getBaseAttributeName,
} from "../plugins/html/utilities.js";

export type TagMetadata = {
  label: string;
  description: string;
  insertText: string;
  package: string;
  sortText: string;
  deprecated: boolean;
  deprecationMessage?: string;
  detail: string;
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
  type: string;
  options?: string[];
};
export type ComponentCache = {
  tag: TagMetadata;
  attributes?: Map<string, ComponentMetadata>;
  attributeValues?: Map<string, ComponentMetadata[]>;
  properties?: Map<string, ComponentMetadata>;
  events?: Map<string, ComponentMetadata>;
  cssVariables?: Map<string, ComponentMetadata>;
  cssParts?: Map<string, ComponentMetadata>;
  cssStates?: Map<string, ComponentMetadata>;
};

export class ComponentService {
  public componentCache: Map<string, ComponentCache> = new Map();
  private config = configurationService.config;
  private typeSrc = this.config.typeSrc;
  private loadedCssVars: Map<string, ComponentMetadata> = new Map();
  private loadedCssParts: Map<string, ComponentMetadata> = new Map();
  private loadedCssStates: Map<string, ComponentMetadata> = new Map();

  dispose() {
    this.componentCache.clear();
    this.loadedCssVars.clear();
    this.loadedCssParts.clear();
    this.loadedCssStates.clear();
  }

  loadCache(tagName: string, component: Component, packageName: string) {
    this.typeSrc =
      configurationService.config.libraries?.[`${packageName}`]?.typeSrc ||
      configurationService.config.typeSrc;
    const cache: ComponentCache = {
      tag: {
        label: "",
        description: "",
        insertText: "",
        package: "",
        sortText: "",
        deprecated: false,
        deprecationMessage: "",
        detail: "",
      },
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
    this.loadAttributeCache(tagName, component);
    this.loadPropertyCache(tagName, component);
    this.loadEventCache(tagName, component);
    this.loadCssVariableCache(tagName, component);
    this.loadCssPartCache(tagName, component);
    this.loadCssStateCache(tagName, component);
  }

  public getComponentCache(tagName: string): ComponentCache | undefined {
    return this.componentCache.get(tagName);
  }

  public getAttributeCache(
    tagName: string,
    attributeName: string
  ): ComponentMetadata | undefined {
    return this.componentCache.get(tagName)?.attributes?.get(attributeName);
  }

  public getPropertyCache(
    tagName: string,
    propertyName: string
  ): ComponentMetadata | undefined {
    return this.componentCache.get(tagName)?.properties?.get(propertyName);
  }

  public getEventCache(
    tagName: string,
    eventName: string
  ): ComponentMetadata | undefined {
    return this.componentCache.get(tagName)?.events?.get(eventName);
  }

  public getCssVariableCache(
    cssVarName: string
  ): ComponentMetadata | undefined {
    return this.loadedCssVars.get(cssVarName);
  }

  public getCssPartCache(cssPartName: string): ComponentMetadata | undefined {
    return this.loadedCssParts.get(cssPartName);
  }

  public getCssStateCache(cssStateName: string): ComponentMetadata | undefined {
    return this.loadedCssStates.get(cssStateName);
  }

  public getAttributeByPrefix(
    tagName: string,
    rawAttrName: string
  ): ComponentMetadata | undefined {
    const component = this.componentCache.get(tagName);
    if (!component || !component.attributes) {
      return undefined;
    }

    const baseAttrName = getBaseAttributeName(rawAttrName);
    const prefix = getAttributePrefix(rawAttrName);

    if (
      !prefix ||
      prefix === "?" ||
      rawAttrName.startsWith("[attr.") ||
      rawAttrName.startsWith(":")
    ) {
      // No prefix, try to find by exact name
      const attribute = componentService.getAttributeCache(
        tagName,
        baseAttrName
      );
      if (attribute) {
        return attribute;
      }
    }

    if (prefix === "[") {
      // Property binding, try to find by base name
      const attribute = componentService.getPropertyCache(
        tagName,
        baseAttrName
      );
      if (attribute) {
        return attribute;
      }
    }

    if (prefix === "(" || prefix === "@" || rawAttrName.startsWith("on")) {
      // Event binding, try to find by base name
      const attribute = componentService.getEventCache(tagName, baseAttrName);
      if (attribute) {
        return attribute;
      }
    }

    if (prefix === ":" || prefix === ".") {
      const prop = componentService.getPropertyCache(tagName, baseAttrName);
      if (prop) {
        return prop;
      }
    }

    return undefined;
  }

  private loadTagCache(
    tagName: string,
    component: Component,
    packageName: string
  ) {
    const metadata: TagMetadata = {
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
      detail: `Custom Element from ${packageName || "Global"}`,
    };
    this.componentCache.get(tagName)!.tag = metadata;
  }

  private loadAttributeCache(tagName: string, component: Component) {
    component.attributes?.forEach((attr) => {
      const attrType = parseAttributeValueOptions(attr, this.typeSrc);
      const hasOptions = Array.isArray(attrType) && attrType.length > 0;
      const displayType = hasOptions
        ? (attrType as string[]).join(" | ")
        : (attrType as string);
      const metadata: ComponentMetadata = {
        label: attr.name,
        description: attr.description || "No description available.",
        filterText: attr.name, // ensures typing '?' filters correctly
        sortText: `0${attr.name}`, // ensures these show above custom attributes
        insertText: this.getInsertTextFormat(
          attr.name,
          hasOptions,
          attrType === "boolean"
        ),
        deprecated: !!attr.deprecated,
        deprecationMessage: this.getDeprecatedMessage(
          attr.deprecated,
          "This attribute is deprecated."
        ),
        detail: `Type: ${displayType}`,
        type: displayType,
        options: hasOptions ? attrType : undefined,
      };
      this.componentCache.get(tagName)!.attributes?.set(attr.name, metadata);
    });
  }

  private loadPropertyCache(tagName: string, component: Component) {
    const props = getComponentPublicProperties(component);
    props.forEach((prop) => {
      const displayType = this.getParsedType(prop);
      const metadata: ComponentMetadata = {
        label: prop.name,
        description: prop.description || "No description available.",
        filterText: prop.name,
        sortText: `0${prop.name}`, // ensures these show below attributes
        insertText: `${prop.name}="$0"`,
        deprecated: !!prop.deprecated,
        deprecationMessage: this.getDeprecatedMessage(
          prop.deprecated,
          "This property is deprecated."
        ),
        detail: `Type: ${displayType}`,
        type: displayType,
      };
      this.componentCache.get(tagName)!.properties?.set(prop.name, metadata);
    });
  }

  private loadEventCache(tagName: string, component: Component) {
    component.events?.forEach((event) => {
      const displayType = this.getParsedType(event, "Event");
      const metadata: ComponentMetadata = {
        label: event.name,
        description: event.description || "No description available.",
        filterText: event.name,
        sortText: `0${event.name}`,
        insertText: event.name,
        deprecated: !!event.deprecated,
        deprecationMessage: this.getDeprecatedMessage(
          event.deprecated,
          "This event is deprecated."
        ),
        detail: `Type: ${displayType}`,
        type: displayType,
      };
      this.componentCache.get(tagName)!.events?.set(event.name, metadata);
    });
  }

  private loadCssVariableCache(tagName: string, component: Component) {
    component.cssProperties?.forEach((cssVar) => {
      const metadata: ComponentMetadata = {
        label: cssVar.name,
        description: cssVar.description || "No description available.",
        filterText: cssVar.name,
        sortText: `xx${cssVar.name}`,
        insertText: cssVar.name,
        deprecated: !!cssVar.deprecated,
        deprecationMessage: this.getDeprecatedMessage(
          cssVar.deprecated,
          "This CSS variable is deprecated."
        ),
        detail: `CSS Custom Property`,
        type: "string",
      };
      this.componentCache
        .get(tagName)!
        .cssVariables?.set(cssVar.name, metadata);
      this.loadedCssVars.set(cssVar.name, metadata);
    });
  }

  private loadCssPartCache(tagName: string, component: Component) {
    component.cssParts?.forEach((cssPart) => {
      const metadata: ComponentMetadata = {
        label: cssPart.name,
        description: cssPart.description || "No description available.",
        filterText: cssPart.name,
        sortText: `xx${cssPart.name}`,
        insertText: `part(${cssPart.name})`,
        deprecated: !!cssPart.deprecated,
        deprecationMessage: this.getDeprecatedMessage(
          cssPart.deprecated,
          "This CSS part is deprecated."
        ),
        detail: `CSS Part`,
        type: "string",
      };
      this.componentCache.get(tagName)!.cssParts?.set(cssPart.name, metadata);
      this.loadedCssParts.set(cssPart.name, metadata);
    });
  }

  private loadCssStateCache(tagName: string, component: Component) {
    component.cssStates?.forEach((cssState) => {
      const metadata: ComponentMetadata = {
        label: cssState.name,
        description: cssState.description || "No description available.",
        filterText: cssState.name,
        sortText: `xx${cssState.name}`,
        insertText: `state(${cssState.name})`,
        deprecated: !!cssState.deprecated,
        deprecationMessage: this.getDeprecatedMessage(
          cssState.deprecated,
          "This CSS state is deprecated."
        ),
        detail: `CSS State`,
        type: "string",
      };
      this.componentCache.get(tagName)!.cssStates?.set(cssState.name, metadata);
      this.loadedCssStates.set(cssState.name, metadata);
    });
  }

  private getInsertTextFormat(
    attrName: string,
    hasValues?: boolean,
    isBoolean?: boolean
  ): string {
    return hasValues
      ? `${attrName}="$1"$0`
      : isBoolean
        ? `${attrName}`
        : `${attrName}="$0"`;
  }

  private getDeprecatedMessage(
    deprecated: string | boolean = false,
    fallbackMessage: string
  ): string {
    return typeof deprecated === "string" ? deprecated : fallbackMessage;
  }

  private getParsedType(member: unknown, fallback: string = "string"): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = member as any;
    return metadata[`${this.typeSrc}`]?.text || metadata.type?.text || fallback;
  }
}

let _singletonComponentService: ComponentService | undefined;

export function getComponentService(): ComponentService {
  if (!_singletonComponentService) {
    _singletonComponentService = new ComponentService();
  }
  return _singletonComponentService;
}

export const componentService = getComponentService();
