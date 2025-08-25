import * as fs from 'fs';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';
import { minimatch } from 'minimatch';

// For now, let's redefine the types locally until we resolve the import issues
export interface WCConfig {
  manifestSrc?: string;
  include?: string[];
  exclude?: string[];
  tagFormatter?: (tagName: string) => string;
  diagnosticSeverity?: {
    unknownElement?: 'error' | 'warning' | 'info' | 'hint';
    unknownAttribute?: 'error' | 'warning' | 'info' | 'hint';
    deprecatedElement?: 'error' | 'warning' | 'info' | 'hint';
    deprecatedAttribute?: 'error' | 'warning' | 'info' | 'hint';
  };
}

export interface DiagnosticResult {
  file: string;
  diagnostics: Diagnostic[];
}

interface CustomElementAttribute {
  name: string;
  type?: { text: string };
  deprecated?: boolean | string;
}

interface CustomElementInfo {
  tagName: string;
  attributes?: CustomElementAttribute[];
  deprecated?: boolean | string;
}

export class DiagnosticEngine {
  private config: WCConfig;
  private customElements = new Map<string, CustomElementInfo>();

  constructor(config: WCConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Load custom elements manifest if available
    await this.loadCustomElementsManifest();
  }

  async validateFiles(files: string[]): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    for (const file of files) {
      if (!this.shouldIncludeFile(file)) {
        continue;
      }

      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const diagnostics = await this.validateFile(file, content);
        
        if (diagnostics.length > 0) {
          results.push({ file, diagnostics });
        }
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }

    return results;
  }

  private async validateFile(filePath: string, content: string): Promise<Diagnostic[]> {
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
    
    // Find all custom elements (tags with hyphens)
    const customElementRegex = /<([a-z]+(?:-[a-z0-9]+)+)(?:\s+[^>]*)?(?:\s*\/?>|>)/gi;
    let match;
    
    while ((match = customElementRegex.exec(content)) !== null) {
      const tagName = match[1];
      const position = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length);
      
      // Check if this is a known custom element
      if (!this.isKnownCustomElement(tagName)) {
        diagnostics.push({
          range: { start: position, end: endPosition },
          message: `Unknown custom element '${tagName}'. Consider adding it to your custom-elements.json manifest.`,
          severity: this.getSeverityFromConfig('unknownElement', DiagnosticSeverity.Warning),
          source: 'wc-toolkit'
        });
      } else {
        // Validate attributes if we have manifest data
        const elementDiagnostics = this.validateElementAttributes(document, match, tagName);
        diagnostics.push(...elementDiagnostics);
      }
    }

    // Find deprecated elements
    const deprecatedElementDiagnostics = this.findDeprecatedElements(document, content);
    diagnostics.push(...deprecatedElementDiagnostics);

    return diagnostics;
  }

  private validateElementAttributes(
    document: TextDocument, 
    match: RegExpExecArray, 
    tagName: string
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const element = this.customElements.get(tagName);
    
    if (!element || !element.attributes) {
      return diagnostics;
    }

    const fullMatch = match[0];
    const attributeRegex = /(\w+(?:-\w+)*)(?:\s*=\s*("[^"]*"|'[^']*'|\S+))?/g;
    let attrMatch;

    while ((attrMatch = attributeRegex.exec(fullMatch)) !== null) {
      const attrName = attrMatch[1];
      
      // Check if attribute exists on the element
      const attribute = element.attributes.find((attr: CustomElementAttribute) => attr.name === attrName);
      
      if (!attribute) {
        const attrPosition = document.positionAt(match.index + attrMatch.index);
        const attrEndPosition = document.positionAt(match.index + attrMatch.index + attrMatch[0].length);
        
        diagnostics.push({
          range: { start: attrPosition, end: attrEndPosition },
          message: `Unknown attribute '${attrName}' on element '${tagName}'.`,
          severity: this.getSeverityFromConfig('unknownAttribute', DiagnosticSeverity.Information),
          source: 'wc-toolkit'
        });
      } else if (attribute.deprecated) {
        const attrPosition = document.positionAt(match.index + attrMatch.index);
        const attrEndPosition = document.positionAt(match.index + attrMatch.index + attrMatch[0].length);
        
        const deprecatedMessage = typeof attribute.deprecated === 'string' ? ' ' + attribute.deprecated : '';
        diagnostics.push({
          range: { start: attrPosition, end: attrEndPosition },
          message: `Attribute '${attrName}' on element '${tagName}' is deprecated.${deprecatedMessage}`,
          severity: this.getSeverityFromConfig('deprecatedAttribute', DiagnosticSeverity.Warning),
          source: 'wc-toolkit'
        });
      }
    }

    return diagnostics;
  }

  private findDeprecatedElements(document: TextDocument, content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    for (const [tagName, element] of this.customElements.entries()) {
      if (element.deprecated) {
        const regex = new RegExp(`<${tagName}(?:\\s+[^>]*)?(?:\\s*\\/?>|>)`, 'gi');
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          const position = document.positionAt(match.index);
          const endPosition = document.positionAt(match.index + match[0].length);
          
          const deprecatedMessage = typeof element.deprecated === 'string' ? ' ' + element.deprecated : '';
          diagnostics.push({
            range: { start: position, end: endPosition },
            message: `Element '${tagName}' is deprecated.${deprecatedMessage}`,
            severity: this.getSeverityFromConfig('deprecatedElement', DiagnosticSeverity.Warning),
            source: 'wc-toolkit'
          });
        }
      }
    }

    return diagnostics;
  }

  private async loadCustomElementsManifest(): Promise<void> {
    const manifestPaths = [
      'custom-elements.json',
      'dist/custom-elements.json',
      'src/custom-elements.json'
    ];

    if (this.config.manifestSrc) {
      manifestPaths.unshift(this.config.manifestSrc);
    }

    for (const manifestPath of manifestPaths) {
      try {
        if (fs.existsSync(manifestPath)) {
          const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent);
          
          // Process modules and their declarations
          if (manifest.modules) {
            for (const module of manifest.modules) {
              if (module.declarations) {
                for (const declaration of module.declarations) {
                  if (declaration.customElement && declaration.tagName) {
                    let tagName = declaration.tagName;
                    
                    // Apply tag formatter if configured
                    if (this.config.tagFormatter) {
                      tagName = this.config.tagFormatter(tagName);
                    }
                    
                    this.customElements.set(tagName, declaration);
                  }
                }
              }
            }
          }
          
          console.debug(`Loaded custom elements manifest from ${manifestPath}`);
          break;
        }
      } catch (error) {
        console.warn(`Warning: Could not load manifest from ${manifestPath}:`, error);
      }
    }
  }

  private isKnownCustomElement(tagName: string): boolean {
    return this.customElements.has(tagName);
  }

  private shouldIncludeFile(filePath: string): boolean {
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Check exclude patterns first
    if (this.config.exclude) {
      for (const pattern of this.config.exclude) {
        if (minimatch(relativePath, pattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.config.include) {
      for (const pattern of this.config.include) {
        if (minimatch(relativePath, pattern)) {
          return true;
        }
      }
      return false; // If include patterns exist but none match
    }

    return true; // Include by default if no patterns specified
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

  private getSeverityFromConfig(key: keyof NonNullable<WCConfig['diagnosticSeverity']>, defaultSeverity: DiagnosticSeverity): DiagnosticSeverity {
    if (!this.config.diagnosticSeverity || !this.config.diagnosticSeverity[key]) {
      return defaultSeverity;
    }

    const severity = this.config.diagnosticSeverity[key]?.toLowerCase();
    switch (severity) {
      case 'error': return DiagnosticSeverity.Error;
      case 'warning': return DiagnosticSeverity.Warning;
      case 'info':
      case 'information': return DiagnosticSeverity.Information;
      case 'hint': return DiagnosticSeverity.Hint;
      default: return defaultSeverity;
    }
  }
}
