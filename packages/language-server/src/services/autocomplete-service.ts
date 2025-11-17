/* eslint-disable @typescript-eslint/no-explicit-any */
import * as html from "vscode-html-languageservice";
import * as css from "vscode-css-languageservice";
import {
  getAttributePrefix,
  getBaseAttributeName,
} from "../plugins/html/utilities.js";
import {
  ComponentCache,
  ComponentMetadata,
  componentService,
  TagMetadata,
} from "./component-service.js";

export type TagAutocompleteCache = Map<string, html.CompletionItem>;
export type ComponentAutocompleteCache = {
  attributes?: Map<string, html.CompletionItem>;
  attributeValues?: Map<string, html.CompletionItem[]>;
  properties?: Map<string, html.CompletionItem>;
  events?: Map<string, html.CompletionItem>;
  cssVariables?: Map<string, css.CompletionItem>;
  cssParts?: Map<string, css.CompletionItem>;
  cssStates?: Map<string, css.CompletionItem>;
};

export class AutocompleteService {
  public tagCache: TagAutocompleteCache = new Map();
  public componentCache: Map<string, ComponentAutocompleteCache> = new Map();
  private loadedCssVars: Map<string, css.CompletionItem> = new Map();
  private loadedCssParts: Map<string, css.CompletionItem> = new Map();
  private loadedCssStates: Map<string, css.CompletionItem> = new Map();
  private isCacheLoaded: boolean = false;

  dispose() {
    this.componentCache.clear();
    this.tagCache.clear();
    this.loadedCssVars.clear();
    this.loadedCssParts.clear();
    this.loadedCssStates.clear();
    this.isCacheLoaded = false;
  }

  loadCache(tagName: string, componentMeta?: ComponentCache) {
    if (!tagName || !componentMeta) {
      return;
    }

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
    this.loadTagCache(tagName, componentMeta.tag);
    this.loadAttributeCache(tagName, componentMeta.attributes);
    this.loadPropertyCache(tagName, componentMeta.properties);
    this.loadEventCache(tagName, componentMeta.events);
    this.loadCssVariableCache(componentMeta.cssVariables);
    this.loadCssPartCache(componentMeta.cssParts);
    this.loadCssStateCache(componentMeta.cssStates);
  }

  getTagCompletions(
    includeOpeningBrackets: boolean = false
  ): html.CompletionItem[] {
    this.checkCache();
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
  ): html.CompletionItem[] {
    this.checkCache();
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
          const attrInfo = componentCache.attributes?.get(attr.label);
          return (attrInfo as any)?.type === "boolean";
        })
        .map((attr) => {
          return {
            ...attr,
            insertText: `${attr.label}="$1"$0`,
            filterText: attr.label,
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
  ): html.CompletionItem | undefined {
    this.checkCache();
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
  ): html.CompletionItem[] {
    this.checkCache();
    const componentCache = this.componentCache.get(tagName);
    if (!componentCache) {
      return [];
    }

    const attributeNameNormalized = getBaseAttributeName(attributeName);
    return componentCache.attributeValues?.get(attributeNameNormalized) || [];
  }

  public getCssCompletions(): css.CompletionItem[] {
    this.checkCache();
    const allCompletions: css.CompletionItem[] = [];
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
            kind: css.CompletionItemKind.Variable,
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
  ): css.CompletionItem | undefined {
    return this.loadedCssVars.get(propertyName);
  }

  getCssPartCompletion(partName: string): css.CompletionItem | undefined {
    return this.loadedCssParts.get(partName);
  }

  getCssStateCompletion(stateName: string): css.CompletionItem | undefined {
    return this.loadedCssStates.get(stateName);
  }

  private checkCache() {
    if (!this.isCacheLoaded) {
      componentService.componentCache.forEach((value, tagName) =>
        this.loadCache(tagName, value)
      );
      this.isCacheLoaded = true;
    }
  }

  private loadTagCache(tagName: string, tagCache: TagMetadata) {
    const completion: html.CompletionItem = {
      ...tagCache,
      kind: html.CompletionItemKind.Snippet,
      documentation: {
        kind: "markdown",
        value: tagCache.description,
      },
      insertTextFormat: html.InsertTextFormat.Snippet,
    };
    this.tagCache.set(tagName, completion);
  }

  private loadAttributeCache(
    tagName: string,
    attributes?: Map<string, ComponentMetadata>
  ) {
    attributes?.forEach((attr) => {
      const completion: html.CompletionItem = {
        ...attr,
        kind: html.CompletionItemKind.Property,
        insertTextFormat: html.InsertTextFormat.Snippet,
        documentation: {
          kind: "markdown",
          value: attr.description,
        },
      };
      this.componentCache.get(tagName)?.attributes?.set(attr.label, completion);

      const valueCompletions = attr.options
        ?.filter((option) => !option.includes("string & {}"))
        ?.map((option) => {
          const valueCompletion: html.CompletionItem = {
            label: option, // shows user the option value
            filterText: option, // ensures typing filters correctly
            sortText: `0${option}`,
            kind: html.CompletionItemKind.Value,
            insertText: option,
            detail: `Attribute value for ${attr.label}`,
          };
          return valueCompletion;
        });
      if (valueCompletions?.length) {
        this.componentCache
          .get(tagName)
          ?.attributeValues?.set(attr.label, valueCompletions);
      }
    });
  }

  private loadPropertyCache(
    tagName: string,
    properties?: Map<string, ComponentMetadata>
  ) {
    properties?.forEach((prop) => {
      const completion: html.CompletionItem = {
        ...prop,
        kind: html.CompletionItemKind.Property,
        insertTextFormat: html.InsertTextFormat.Snippet,
        documentation: {
          kind: "markdown",
          value: prop.description || "No description available.",
        },
      };
      this.componentCache.get(tagName)?.properties?.set(prop.label, completion);
    });
  }

  private loadEventCache(
    tagName: string,
    events?: Map<string, ComponentMetadata>
  ) {
    events?.forEach((event) => {
      const completion: html.CompletionItem = {
        ...event,
        kind: html.CompletionItemKind.Event,
        insertTextFormat: html.InsertTextFormat.Snippet,
        documentation: {
          kind: "markdown",
          value: event.description || "No description available.",
        },
      };
      this.componentCache.get(tagName)?.events?.set(event.label, completion);
    });
  }

  private loadCssVariableCache(cssVariables?: Map<string, ComponentMetadata>) {
    cssVariables?.forEach((cssVar) => {
      if (this.loadedCssVars.has(cssVar.label)) {
        return;
      }
      const completion: css.CompletionItem = {
        ...cssVar,
        kind: css.CompletionItemKind.Property,
        documentation: {
          kind: "markdown",
          value: cssVar.description,
        },
      };
      this.loadedCssVars.set(cssVar.label, completion);
    });
  }

  private loadCssPartCache(parts?: Map<string, ComponentMetadata>) {
    parts?.forEach((cssPart) => {
      if (this.loadedCssParts.has(cssPart.label)) {
        return;
      }
      const completion: css.CompletionItem = {
        ...cssPart,
        label: `part(${cssPart.label})`,
        kind: css.CompletionItemKind.Function,
        documentation: {
          kind: "markdown",
          value: cssPart.description,
        },
      };
      this.loadedCssParts.set(cssPart.label, completion);
    });
  }

  private loadCssStateCache(states?: Map<string, ComponentMetadata>) {
    states?.forEach((cssState) => {
      if (this.loadedCssStates.has(cssState.label)) {
        return;
      }
      const completion: css.CompletionItem = {
        ...cssState,
        label: `state(${cssState.label})`,
        kind: css.CompletionItemKind.Function,
        documentation: {
          kind: "markdown",
          value: cssState.description,
        },
      };
      this.loadedCssStates.set(cssState.label, completion);
    });
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
