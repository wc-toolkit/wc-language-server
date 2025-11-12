/* eslint-disable @typescript-eslint/no-explicit-any */
import * as html from "vscode-html-languageservice";
import * as css from "vscode-css-languageservice";
import {
  Component,
  getComponentDetailsTemplate,
  getComponentEventsWithType,
  getComponentPublicProperties,
} from "@wc-toolkit/cem-utilities";
import { AttributeInfo, manifestService } from "./manifest-service.js";
import { configurationService } from "./configuration-service.js";
import {
  getAttributePrefix,
  getBaseAttributeName,
} from "../plugins/html/utilities.js";

export type TagAutocompleteCache = Map<string, html.CompletionItem>;
export type ExtendedHtmlCompletionItem = html.CompletionItem & {
  deprecationMessage: string;
};
export type ExtendedCssCompletionItem = css.CompletionItem & {
  deprecationMessage: string;
};
export type ComponentAutocompleteCache = {
  attributes?: Map<string, ExtendedHtmlCompletionItem>;
  attributeValues?: Map<string, ExtendedHtmlCompletionItem[]>;
  properties?: Map<string, ExtendedHtmlCompletionItem>;
  events?: Map<string, ExtendedHtmlCompletionItem>;
  cssVariables?: Map<string, ExtendedCssCompletionItem>;
  cssParts?: Map<string, ExtendedCssCompletionItem>;
  cssStates?: Map<string, ExtendedCssCompletionItem>;
};

export class AutocompleteService {
  public tagCache: TagAutocompleteCache = new Map();
  public componentCache: Map<string, ComponentAutocompleteCache> = new Map();
  private config = configurationService.config;
  private typeSrc = this.config.typeSrc;
  private loadedCssVars: Map<string, ExtendedCssCompletionItem> = new Map();
  private loadedCssParts: Map<string, ExtendedCssCompletionItem> = new Map();
  private loadedCssStates: Map<string, ExtendedCssCompletionItem> = new Map();

  dispose() {
    this.componentCache.clear();
  }

  loadCache(tagName: string, component: Component) {
    const cache: ComponentAutocompleteCache = {
      attributes: new Map(),
      attributeValues: new Map(),
      properties: new Map(),
      events: new Map(),
      cssVariables: new Map(),
      cssParts: new Map(),
      cssStates: new Map(),
    };
    this.componentCache.set(tagName || "unknown", cache);
    this.loadTagCache(tagName, component);
    this.loadAttributeCache(tagName);
    this.loadPropertyCache(tagName, component);
    this.loadEventCache(tagName, component);
    this.loadCssVariableCache(tagName, component);
    this.loadCssPartCache(tagName, component);
    this.loadCssStateCache(tagName, component);
  }

  getTagCompletions(
    includeOpeningBrackets: boolean = false
  ): html.CompletionItem[] {
    if (!includeOpeningBrackets) {
      return Array.from(this.tagCache.values()).map((item) => {
        return {
          ...item,
          insertText: `${item.label}>$0</${item.label}>`,
        };
      });
    }

    return Array.from(this.tagCache.values());
  }

  getAttributeCompletions(
    tagName: string,
    attrPrefix?: string,
    beforeText?: string
  ): ExtendedHtmlCompletionItem[] {
    const componentCache = this.componentCache.get(tagName);
    if (!componentCache) {
      return [];
    }

    let attributes = Array.from(componentCache.attributes?.values() || []);

    if (!attrPrefix && beforeText) {
      return attributes;
    }

    if (attrPrefix === "?") {
      attributes = attributes
        .filter((attr) => {
          const attrInfo = manifestService.getAttributeInfo(
            tagName,
            attr.label
          );
          return attrInfo?.type === "boolean";
        })
        .map((attr) => {
          return {
            ...attr,
            insertText: `${attr.label}="$1"$0`,
          };
        });
    }

    if (attrPrefix === ".") {
      attributes = componentCache.properties
        ? Array.from(componentCache.properties.values())
        : [];
    }

    if (attrPrefix === "@") {
      attributes = componentCache.events
        ? Array.from(componentCache.events.values())
        : [];
    }

    if (attrPrefix === "(") {
      attributes = componentCache.events
        ? Array.from(componentCache.events.values()).map((attr) => {
            return {
              ...attr,
              insertText: `${attr.label})="$1"$0`,
            };
          })
        : [];
    }

    if (attrPrefix === ":") {
      attributes = componentCache.attributes
        ? Array.from(componentCache.attributes.values())
        : [];
    }

    if (attrPrefix === "[") {
      attributes = [
        ...(componentCache.properties
          ? Array.from(componentCache.properties.values()).map((attr) => {
              return {
                ...attr,
                insertText: `${attr.label}]="$1"$0`,
              };
            })
          : []),
        ...(componentCache.attributes
          ? Array.from(componentCache.attributes.values()).map((attr) => {
              return {
                ...attr,
                label: `attr.${attr.label}`,
                insertText: `attr.${attr.label}]="$1"$0`,
              };
            })
          : []),
      ];
    }

    return attributes;
  }

  getAttributeCompletion(
    tagName: string,
    attributeName: string
  ): ExtendedHtmlCompletionItem | undefined {
    const componentCache = this.componentCache.get(tagName);
    if (!componentCache) {
      return undefined;
    }

    const prefix = getAttributePrefix(attributeName);
    const attributeNameNormalized = getBaseAttributeName(attributeName);

    if (!prefix) {
      return componentCache.attributes?.get(attributeName);
    }

    if (prefix === "?") {
      return componentCache.attributes?.get(attributeNameNormalized);
    }

    if (prefix === ".") {
      return componentCache.properties?.get(attributeNameNormalized);
    }

    if (prefix === "@") {
      return componentCache.events?.get(attributeNameNormalized);
    }

    if (prefix === "[") {
      return attributeNameNormalized.startsWith("attr.")
        ? componentCache.attributes?.get(
            attributeNameNormalized.replace("attr.", "")
          )
        : componentCache.properties?.get(attributeNameNormalized);
    }

    if (prefix === "(") {
      return componentCache.events?.get(attributeNameNormalized);
    }

    if (prefix === ":") {
      return (
        componentCache.attributes?.get(attributeNameNormalized) ||
        componentCache.properties?.get(attributeNameNormalized)
      );
    }

    return undefined;
  }

  public getAttributeValueCompletions(
    tagName: string,
    attributeName: string
  ): ExtendedHtmlCompletionItem[] {
    const componentCache = this.componentCache.get(tagName);
    if (!componentCache) {
      return [];
    }

    const attributeNameNormalized = getBaseAttributeName(attributeName);
    return componentCache.attributeValues?.get(attributeNameNormalized) || [];
  }

  public getCssCompletions(): ExtendedCssCompletionItem[] {
    const allCompletions: ExtendedCssCompletionItem[] = [];
    const props = this.loadedCssVars
      ? Array.from(this.loadedCssVars.values())
      : [];
    allCompletions.push(...props);
    const vars = this.loadedCssVars
      ? Array.from(this.loadedCssVars.values()).map((v) => {
          return {
            ...v,
            insertText: `var(${v.label})`,
            filterText: `var ${v.label}`,
            label: `var(${v.label})`,
            sortText: `xxvar(${v.label})`,
          };
        })
      : [];
    allCompletions.push(...vars);
    const parts = this.loadedCssParts
      ? Array.from(this.loadedCssParts.values())
      : [];
    allCompletions.push(...parts);
    const states = this.loadedCssStates
      ? Array.from(this.loadedCssStates.values())
      : [];
    allCompletions.push(...states);
    return allCompletions;
  }

  getCssCustomPropertyCompletion(
    propertyName: string
  ): ExtendedCssCompletionItem | undefined {
    return this.loadedCssVars.get(propertyName);
  }

  getCssPartCompletion(
    partName: string
  ): ExtendedCssCompletionItem | undefined {
    return this.loadedCssParts.get(partName);
  }

  getCssStateCompletion(
    stateName: string
  ): ExtendedCssCompletionItem | undefined {
    return this.loadedCssStates.get(stateName);
  }

  private loadTagCache(tagName: string, component: Component) {
    const completion: html.CompletionItem = {
      label: tagName,
      kind: html.CompletionItemKind.Snippet,
      documentation: {
        kind: "markdown",
        value: getComponentDetailsTemplate(component),
      },
      insertText: `<${tagName}>$0</${tagName}>`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      detail: "Custom Element",
      sortText: "0" + tagName,
      deprecated: !!component.deprecated,
    };
    this.tagCache.set(tagName, completion);
  }

  private loadAttributeCache(tagName: string) {
    const attrs = this.getAttributeInfo(tagName);
    attrs.forEach((attr) => {
      const completion: ExtendedHtmlCompletionItem = {
        label: attr.name, // shows user the prefixed form
        filterText: attr.name, // ensures typing '?' filters correctly
        sortText: `0${attr.name}`, // ensures these show above custom attributes
        kind: html.CompletionItemKind.Property,
        insertText: this.getInsertTextFormat(
          attr,
          !!attr.options?.length,
          attr.type === "boolean"
        ),
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: attr.type || "string",
        documentation: attr.description,
        deprecated: !!attr.deprecated,
        deprecationMessage:
          typeof attr.deprecated === "string"
            ? attr.deprecated
            : "This attribute is deprecated.",
      };
      this.componentCache.get(tagName)?.attributes?.set(attr.name, completion);

      const valueCompletions = attr.options?.map((option) => {
        const valueCompletion: ExtendedHtmlCompletionItem = {
          label: option, // shows user the option value
          filterText: option, // ensures typing filters correctly
          sortText: `0${option}`,
          kind: html.CompletionItemKind.Value,
          insertText: option,
          detail: `Attribute value for ${attr.name}`,
          deprecationMessage: "",
        };
        return valueCompletion;
      });
      if (valueCompletions?.length) {
        this.componentCache
          .get(tagName)
          ?.attributeValues?.set(attr.name, valueCompletions);
      }
    });
  }

  private getInsertTextFormat(
    attr: AttributeInfo,
    hasValues?: boolean,
    isBoolean?: boolean
  ): string {
    return hasValues
      ? `${attr.name}="$1"$0`
      : isBoolean
        ? `${attr.name}`
        : `${attr.name}="$0"`;
  }

  private loadPropertyCache(tagName: string, component: Component) {
    const props = getComponentPublicProperties(component);

    props.forEach((prop) => {
      const completion: ExtendedHtmlCompletionItem = {
        label: prop.name,
        sortText: `0${prop.name}`,
        kind: html.CompletionItemKind.Property,
        insertText: `${prop.name}="$0"`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail:
          (prop[this.typeSrc || "parsedType"] as any)?.text ||
          prop.type?.text ||
          "any",
        documentation: prop.description,
        deprecated: !!prop.deprecated,
        deprecationMessage:
          typeof prop.deprecationMessage === "string"
            ? prop.deprecationMessage
            : "This property is deprecated.",
      };
      this.componentCache.get(tagName)?.properties?.set(prop.name, completion);
    });
  }

  private loadEventCache(tagName: string, component: Component) {
    const events = getComponentEventsWithType(component);

    events.forEach((event) => {
      const completion: ExtendedHtmlCompletionItem = {
        label: event.name,
        sortText: `0${event.name}`,
        kind: html.CompletionItemKind.Event,
        insertText: `${event.name}="$0"`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: event.type?.text || "Event",
        documentation: event.description,
        deprecated: !!event.deprecated,
        deprecationMessage:
          typeof event.deprecated === "string"
            ? event.deprecated
            : "This event is deprecated.",
      };
      this.componentCache.get(tagName)?.events?.set(event.name, completion);
    });
  }

  private loadCssVariableCache(tagName: string, component: Component) {
    const cssVars = component.cssProperties || [];
    cssVars.forEach((cssVar) => {
      if (this.loadedCssVars.has(cssVar.name)) {
        return;
      }
      const completion: ExtendedCssCompletionItem = {
        label: cssVar.name, // e.g., "--my-color"
        sortText: `aa${cssVar.name}`, // Sort before var() versions
        filterText: cssVar.name, // Ensure it matches when typing "--"
        kind: css.CompletionItemKind.Variable,
        insertText: cssVar.name,
        detail: "CSS Variable",
        documentation: cssVar.description,
        deprecated: !!cssVar.deprecated,
        deprecationMessage:
          typeof cssVar.deprecated === "string"
            ? cssVar.deprecated
            : "This CSS variable is deprecated.",
      };
      this.loadedCssVars.set(cssVar.name, completion);
      this.componentCache
        .get(tagName)
        ?.cssVariables?.set(cssVar.name, completion);
    });
  }

  private loadCssPartCache(tagName: string, component: Component) {
    const cssParts = component.cssParts || [];
    cssParts.forEach((cssPart) => {
      if (this.loadedCssParts.has(cssPart.name)) {
        return;
      }
      const completion: ExtendedCssCompletionItem = {
        label: `part(${cssPart.name})`,
        filterText: `part ${cssPart.name}`,
        sortText: `xx${cssPart.name}`,
        kind: css.CompletionItemKind.Function,
        insertText: `part(${cssPart.name})`,
        detail: "CSS Part",
        documentation: cssPart.description,
        deprecated: !!cssPart.deprecated,
        deprecationMessage:
          typeof cssPart.deprecated === "string"
            ? cssPart.deprecated
            : "This CSS part is deprecated.",
      };
      this.loadedCssParts.set(cssPart.name, completion);
      this.componentCache.get(tagName)?.cssParts?.set(cssPart.name, completion);
    });
  }

  private loadCssStateCache(tagName: string, component: Component) {
    const cssStates = component.cssStates || [];
    cssStates.forEach((cssState) => {
      if (this.loadedCssStates.has(cssState.name)) {
        return;
      }
      const completion: ExtendedCssCompletionItem = {
        label: `state(${cssState.name})`,
        sortText: `xx${cssState.name}`,
        kind: css.CompletionItemKind.Function,
        insertText: `state(${cssState.name})`,
        detail: "CSS State",
        documentation: cssState.description,
        deprecated: !!cssState.deprecated,
        deprecationMessage:
          typeof cssState.deprecated === "string"
            ? cssState.deprecated
            : "This CSS state is deprecated.",
      };
      this.loadedCssStates.set(cssState.name, completion);
      this.componentCache
        .get(tagName)
        ?.cssStates?.set(cssState.name, completion);
    });
  }

  private getAttributeInfo(tagName: string): AttributeInfo[] {
    return Array.from(manifestService.attributeData?.entries())
      .filter(([key]) => key.startsWith(`${tagName}:`))
      .map(([, value]) => value);
  }
}

let _singletonAutocompleteService: AutocompleteService | undefined;

export function getAutocompleteService(): AutocompleteService {
  if (!_singletonAutocompleteService) {
    _singletonAutocompleteService = new AutocompleteService();
  }
  return _singletonAutocompleteService;
}

export const autocompleteService = getAutocompleteService();
