import * as fs from 'fs';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';
import { minimatch } from 'minimatch';
import { Component, getAllComponents } from '@wc-toolkit/cem-utilities';

export interface WCConfig {
  manifestSrc?: string;
  typeSrc?: string;
  include?: string[];
  exclude?: string[];
  libraries?: Record<string, {
    manifestSrc?: string;
    typeSrc?: string;
    prefix?: string;
    tagNameTransform?: 'camelCase' | 'kebabCase' | 'none';
  }>;
  validationRules?: {
    deprecation?: 'error' | 'warn' | 'info' | 'off';
    unknownTag?: 'error' | 'warn' | 'info' | 'off';
    unknownAttribute?: 'error' | 'warn' | 'info' | 'off';
  };
}

export interface DiagnosticResult {
  file: string;
  diagnostics: Diagnostic[];
}

export class DiagnosticEngine {
  private config: WCConfig;
  private customElements = new Map<string, Component>();

  constructor(config: WCConfig) {
    this.config = {
      // Set default validation rules if not provided
      validationRules: {
        deprecation: 'warn',
        unknownTag: 'warn', 
        unknownAttribute: 'info',
        ...config.validationRules
      },
      ...config
    };
    this.loadCustomElementsManifest();
  }

  async validateFiles(files: string[]): Promise<DiagnosticResult[]> {
    return this.processFiles(files);
  }

  private loadCustomElementsManifest(): void {
    if (!this.config.manifestSrc) return;

    try {
      const manifestPath = path.isAbsolute(this.config.manifestSrc) 
        ? this.config.manifestSrc 
        : path.resolve(process.cwd(), this.config.manifestSrc);
      
      if (!fs.existsSync(manifestPath)) {
        console.warn(`Custom elements manifest not found at: ${manifestPath}`);
        return;
      }

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      if (manifest?.modules) {
        const components = getAllComponents(manifest);
        components.forEach(component => {
          if (component.tagName) {
            this.customElements.set(component.tagName, component);
          }
        });
        console.log(`Loaded ${components.length} custom elements from manifest`);
      }
    } catch (error) {
      console.error('Error loading custom elements manifest:', error);
    }
  }

  async initialize(): Promise<void> {
    // Initialize method for compatibility with CLI
    // Manifest is already loaded in constructor
    console.log("Diagnostic engine initialized");
  }

  async processFiles(files: string[]): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    for (const file of files) {
      if (!this.shouldIncludeFile(file)) {
        continue;
      }
      
      const result = await this.processFile(file);
      if (result.diagnostics.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  private shouldIncludeFile(filePath: string): boolean {
    // Basic file inclusion logic - can be expanded based on config
    const excludePatterns = ['node_modules/**', '**/*.min.*', 'dist/**', 'build/**'];
    const baseName = path.basename(filePath);
    
    return excludePatterns.every(pattern => !minimatch(filePath, pattern)) &&
           ['.html', '.htm', '.vue', '.jsx', '.tsx', '.js', '.ts'].some(ext => baseName.endsWith(ext));
  }

  private async processFile(filePath: string): Promise<DiagnosticResult> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const diagnostics = await this.validateFile(filePath, content);
      
      return {
        file: filePath,
        diagnostics
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return {
        file: filePath,
        diagnostics: []
      };
    }
  }  private async validateFile(filePath: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const document = TextDocument.create(`file://${filePath}`, this.getLanguageId(filePath), 1, content);

    // Custom element validation for HTML, JS, and TS files
    if (this.isWebComponentFile(filePath)) {
      const customElementDiagnostics = await this.validateCustomElements(document);
      diagnostics.push(...customElementDiagnostics);
    }

    return diagnostics;
  }

  private async validateCustomElements(document: TextDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const content = document.getText();
    
    // Find all opening tags that look like custom elements
    const tagRegex = /<([a-z]+(?:-[a-z0-9]+)+)([^>]*)>/gi;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      const tagName = match[1];
      const attributesPart = match[2] || '';
      
      // Position of the tag name
      const tagPosition = document.positionAt(match.index + 1); // +1 to skip the '<'
      const tagEndPosition = document.positionAt(match.index + 1 + tagName.length);
      
      // Check if this is a known custom element
      if (!this.customElements.has(tagName)) {
        const severity = this.getSeverityFromConfig('unknownTag', DiagnosticSeverity.Warning);
        if (severity !== DiagnosticSeverity.Hint) { // Don't add diagnostic if severity is 'off' (Hint)
          diagnostics.push({
            range: { start: tagPosition, end: tagEndPosition },
            message: `Unknown custom element '${tagName}'. Consider adding it to your custom-elements.json manifest.`,
            severity: severity,
            source: 'wc-toolkit'
          });
        }
      } else {
        // Validate attributes if we have manifest data
        const elementDiagnostics = this.validateElementAttributesFromString(
          document, 
          tagName, 
          attributesPart, 
          match.index + 1 + tagName.length // Start position of attributes part
        );
        diagnostics.push(...elementDiagnostics);
      }
    }

    // Find deprecated elements
    const deprecatedElementDiagnostics = this.findDeprecatedElements(document, content);
    diagnostics.push(...deprecatedElementDiagnostics);

    return diagnostics;
  }

  private validateElementAttributesFromString(
    document: TextDocument, 
    tagName: string,
    attributesString: string,
    attributesStartOffset: number
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const element = this.customElements.get(tagName);
    
    if (!element || !element.attributes) {
      return diagnostics;
    }

    if (!attributesString.trim()) {
      return diagnostics; // No attributes
    }
    
    // Parse attributes: attr1="value" attr2 attr3="value"
    const attributeRegex = /(\w+(?:-\w+)*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;
    let attrMatch;

    while ((attrMatch = attributeRegex.exec(attributesString)) !== null) {
      const attrName = attrMatch[1];
      
      // Check if attribute exists on the element using the service
      // Find attribute info from the element
      const attributeInfo = element?.attributes?.find(attr => attr.name === attrName);
      
      if (!attributeInfo) {
        const attrPosition = document.positionAt(attributesStartOffset + attrMatch.index);
        const attrEndPosition = document.positionAt(attributesStartOffset + attrMatch.index + attrName.length);
        
        const severity = this.getSeverityFromConfig('unknownAttribute', DiagnosticSeverity.Information);
        if (severity !== DiagnosticSeverity.Hint) { // Don't add diagnostic if severity is 'off' (Hint)
          diagnostics.push({
            range: { start: attrPosition, end: attrEndPosition },
            message: `Unknown attribute '${attrName}' on element '${tagName}'.`,
            severity: severity,
            source: 'wc-toolkit'
          });
        }
      } else if (attributeInfo.deprecated) {
        const attrPosition = document.positionAt(attributesStartOffset + attrMatch.index);
        const attrEndPosition = document.positionAt(attributesStartOffset + attrMatch.index + attrName.length);
        
        const deprecatedMessage = typeof attributeInfo.deprecated === 'string' ? ' ' + attributeInfo.deprecated : '';
        diagnostics.push({
          range: { start: attrPosition, end: attrEndPosition },
          message: `Attribute '${attrName}' on element '${tagName}' is deprecated.${deprecatedMessage}`,
          severity: this.getSeverityFromConfig('deprecation', DiagnosticSeverity.Warning),
          source: 'wc-toolkit'
        });
      }
    }

    return diagnostics;
  }

  private findDeprecatedElements(document: TextDocument, content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    // Get all custom elements from the service
    const customElements = Array.from(this.customElements.values());
    
    for (const element of customElements) {
      if (element.deprecated) {
        const regex = new RegExp(`<${element.tagName}(?:\\s+[^>]*)?(?:\\s*\\/?>|>)`, 'gi');
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          const position = document.positionAt(match.index);
          const endPosition = document.positionAt(match.index + match[0].length);
          
          const deprecatedMessage = typeof element.deprecated === 'string' ? ' ' + element.deprecated : '';
          diagnostics.push({
            range: { start: position, end: endPosition },
            message: `Element '${element.tagName}' is deprecated.${deprecatedMessage}`,
            severity: this.getSeverityFromConfig('deprecation', DiagnosticSeverity.Warning),
            source: 'wc-toolkit'
          });
        }
      }
    }

    return diagnostics;
  }

  private getSeverityFromConfig(key: keyof NonNullable<WCConfig['validationRules']>, defaultSeverity: DiagnosticSeverity): DiagnosticSeverity {
    const severityConfig = this.config.validationRules?.[key];
    
    switch (severityConfig) {
      case 'error':
        return DiagnosticSeverity.Error;
      case 'warn':
        return DiagnosticSeverity.Warning;
      case 'info':
        return DiagnosticSeverity.Information;
      case 'off':
        return DiagnosticSeverity.Hint; // Use hint for 'off' to minimize noise
      default:
        return defaultSeverity;
    }
  }

  private isWebComponentFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.html', '.htm', '.vue', '.svelte', '.js', '.ts', '.jsx', '.tsx', '.md', '.mdx'].includes(ext);
  }

  private getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.html':
      case '.htm': return 'html';
      case '.vue': return 'vue';
      case '.svelte': return 'svelte';
      case '.js': return 'javascript';
      case '.ts': return 'typescript';
      case '.jsx': return 'javascriptreact';
      case '.tsx': return 'typescriptreact';
      case '.md':
      case '.mdx': return 'markdown';
      default: return 'plaintext';
    }
  }
}
