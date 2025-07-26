import type * as cem from 'custom-elements-manifest/schema' with { 'resolution-mode': 'require' };

export interface LanguageServerAdapter {
  createCompletionItem(tag: string, description: string, attributes?: HTMLDataAttribute[]): any;
  createHTMLDataProvider?(tags: HTMLDataTag[]): any;
  createHoverInfo?(tag: string, description: string): any;
  
  // Existing methods for attribute completion
  createAttributeCompletionItem?(attribute: HTMLDataAttribute, tagName: string): any;
  createAttributeValueCompletionItem?(attribute: HTMLDataAttribute, value: HTMLDataAttributeValue, tagName: string): any;
  
  // New methods for definition provider
  createTagDefinitionLocation?(tagName: string, manifestPath: string, position: number): any;
  createAttributeDefinitionLocation?(tagName: string, attributeName: string, manifestPath: string, position: number): any;

  // New method for completion list
  createCompletionList(elements: cem.CustomElement[]): any;

  // New method for diagnostics
  createDiagnostic?(range: any, message: string, severity: number): any;
}

export interface HTMLDataTag {
  name: string;
  description?: string;
  attributes: HTMLDataAttribute[];
  // Add source information for definition lookup
  sourcePosition?: number; // Position in the manifest file
}

export interface HTMLDataAttribute {
  name: string;
  description?: string;
  valueSet?: string;
  values?: HTMLDataAttributeValue[];
  type?: string;
  // Add source information for definition lookup
  sourcePosition?: number; // Position in the manifest file
}

export interface HTMLDataAttributeValue {
  name: string;
  description?: string;
}
