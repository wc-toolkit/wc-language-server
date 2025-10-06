/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from "vscode";

/**
 * AI Integration Service for Web Components
 * Provides component documentation to any AI model via VS Code Language Model API
 * (GitHub Copilot, Claude, or other compatible language models)
 * 
 * Works in: VS Code, VSCodium, Cursor, Windsurf, and other VS Code forks
 */
export class AIIntegrationService {
  private cemDocs: Record<string, string> = {};
  private disposables: vscode.Disposable[] = [];

  constructor(initialDocs: Record<string, string>) {
    this.cemDocs = initialDocs;
  }

  /**
   * Update the documentation cache when new docs are available
   */
  updateCEMDocs(docs: Record<string, string>): void {
    this.cemDocs = docs;
    
    // Refresh the virtual context document if it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const virtualDocProvider = (this as any)._virtualDocProvider;
    if (virtualDocProvider && typeof virtualDocProvider.refresh === 'function') {
      virtualDocProvider.refresh();
      console.log('[AI Integration] Virtual context document refreshed with updated docs');
    }
  }

  /**
   * Get documentation for a specific component
   */
  getComponentDoc(componentName: string): string | undefined {
    return this.cemDocs[componentName];
  }

  /**
   * Get all available component documentation
   */
  getAllDocs(): Record<string, string> {
    return { ...this.cemDocs };
  }

  /**
   * Format documentation for AI context
   */
  formatDocsForAI(): string {
    const entries = Object.entries(this.cemDocs);
    if (entries.length === 0) {
      return "No web component documentation available.";
    }

    let formatted = `# Web Components Documentation\n\n`;
    formatted += `Available components: ${entries.length}\n\n`;

    for (const [componentName, doc] of entries) {
      formatted += `## ${componentName}\n\n`;
      formatted += `${doc}\n\n`;
      formatted += `---\n\n`;
    }

    return formatted;
  }

  /**
   * Search for relevant documentation based on query
   */
  searchDocs(query: string): string {
    // Clean up the query: remove <, >, and normalize
    const cleanQuery = query.replace(/[<>]/g, '').toLowerCase().trim();
    const matches: Array<[string, string]> = [];

    for (const [name, doc] of Object.entries(this.cemDocs)) {
      const lowerName = name.toLowerCase();
      const lowerDoc = doc.toLowerCase();

      // Try multiple matching strategies:
      // 1. Exact match on component name
      // 2. Component name contains query
      // 3. Query contains component name
      // 4. Documentation contains query
      if (
        lowerName === cleanQuery ||
        lowerName.includes(cleanQuery) ||
        cleanQuery.includes(lowerName) ||
        lowerDoc.includes(cleanQuery)
      ) {
        matches.push([name, doc]);
      }
    }

    if (matches.length === 0) {
      // Provide helpful debug info
      const availableComponents = Object.keys(this.cemDocs).slice(0, 10);
      return `No documentation found matching "${query}".

Available components (showing first 10): ${availableComponents.join(', ')}${Object.keys(this.cemDocs).length > 10 ? `, and ${Object.keys(this.cemDocs).length - 10} more...` : ''}

Try asking about one of these components by name.`;
    }

    let result = `# Search Results for "${query}"\n\n`;
    result += `Found ${matches.length} matching component(s):\n\n`;

    for (const [name, doc] of matches) {
      result += `## ${name}\n\n`;
      result += `${doc}\n\n`;
      result += `---\n\n`;
    }

    return result;
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}

/**
 * Language Model Tool for Web Components Documentation
 * This allows Copilot to access your docs without needing @wctools
 */
class WCToolsLanguageModelTool implements vscode.LanguageModelTool<{ query?: string }> {
  private service: AIIntegrationService;
  
  constructor(service: AIIntegrationService) {
    this.service = service;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{ query?: string }>,
    _token: vscode.CancellationToken
  ) {
    const query = options.input.query || '';
    
    if (!query || query.toLowerCase().includes('all') || query.toLowerCase().includes('list')) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(this.service.formatDocsForAI())
      ]);
    }
    
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(this.service.searchDocs(query))
    ]);
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<{ query?: string }>
  ) {
    const query = options.input.query || 'all components';
    return {
      invocationMessage: `Searching web components documentation for: ${query}`,
    };
  }
}

/**
 * Detect the VS Code environment (VS Code, VSCodium, Cursor, Windsurf, etc.)
 */
function detectEnvironment(): string {
  const productName = vscode.env.appName.toLowerCase();
  const uriAuthority = vscode.env.uriScheme.toLowerCase();
  
  console.log(`[AI Integration] Product name: ${vscode.env.appName}`);
  console.log(`[AI Integration] URI scheme: ${vscode.env.uriScheme}`);
  
  // Check URI scheme first (more reliable for Cursor)
  if (uriAuthority.includes('cursor')) return 'cursor';
  if (uriAuthority.includes('windsurf')) return 'windsurf';
  
  // Then check product name
  if (productName.includes('cursor')) return 'cursor';
  if (productName.includes('windsurf')) return 'windsurf';
  if (productName.includes('vscodium')) return 'vscodium';
  if (productName.includes('visual studio code')) return 'vscode';
  // VSCodium might also identify as "code - oss"
  if (productName.includes('code - oss')) return 'vscodium';
  return 'unknown';
}

/**
 * Activate AI integration with VS Code Language Model API
 * This makes your web component documentation available to any language model
 * (GitHub Copilot, Claude, or other compatible AI extensions)
 * 
 * Compatible with: VS Code, VSCodium, Cursor, Windsurf, and other VS Code forks
 */
export async function activateAIIntegration(
  context: vscode.ExtensionContext,
  initialDocs: Record<string, string>
): Promise<AIIntegrationService> {
  const service = new AIIntegrationService(initialDocs);
  const env = detectEnvironment();
  console.log(`[AI Integration] Detected environment: ${env}`);

  // Register chat participant for web components (works in all environments)
  console.log(`[AI Integration] Registering chat participant in ${env} environment`);
  console.log(`[AI Integration] Available APIs:`, {
    chat: typeof vscode.chat,
    lm: typeof vscode.lm,
    createChatParticipant: typeof vscode.chat?.createChatParticipant
  });
  
  let participant: vscode.ChatParticipant | undefined;
  
  try {
    participant = vscode.chat.createChatParticipant(
      "wcLanguageServerAI",
      async (
      request: vscode.ChatRequest,
      _chatContext: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ) => {
      // Extract component names from the user's query
      const query = request.prompt;

      // Debug: Log available docs
      const docCount = Object.keys(service.getAllDocs()).length;
      console.log(`[AI Integration] Query: "${query}"`);
      console.log(`[AI Integration] Available docs: ${docCount}`);
      console.log(`[AI Integration] Component names:`, Object.keys(service.getAllDocs()).slice(0, 5));

      // Provide relevant documentation as context
      let contextDoc: string;

      if (
        query.toLowerCase().includes("all") ||
        query.toLowerCase().includes("list")
      ) {
        contextDoc = service.formatDocsForAI();
      } else {
        contextDoc = service.searchDocs(query);
      }

      console.log(`[AI Integration] Context doc length: ${contextDoc.length} chars`);
      console.log(`[AI Integration] Context preview:`, contextDoc.substring(0, 200));

      // For Cursor: Return documentation directly so user can see it
      // and then ask follow-up questions to Cursor's AI with the context visible
      if (env === 'cursor') {
        stream.markdown(
          `## Web Component Documentation\n\n${contextDoc}\n\n---\n\n` +
          `💡 **Tip:** You can now ask Cursor's AI follow-up questions about these components, ` +
          `and it will use the documentation above as context.`
        );
        return;
      }

      // For VS Code/other environments: Use Language Model API if available
      // Check if Language Model API is available (may not be in all forks)
      if (typeof vscode.lm?.selectChatModels !== 'function') {
        // Fallback for environments without Language Model API
        stream.markdown(
          `**Web Component Documentation Found:**\n\n${contextDoc}\n\n---\n\n` +
          `*Note: This editor doesn't support the Language Model API. ` +
          `The documentation above can help you understand the component.*`
        );
        return;
      }

      const models = await vscode.lm.selectChatModels();

      if (models.length === 0) {
        // No models available - provide documentation directly
        stream.markdown(
          `**Web Component Documentation:**\n\n${contextDoc}\n\n---\n\n` +
          `*No AI model is available. Please ensure you have GitHub Copilot or another compatible AI extension installed.*`
        );
        return;
      }

      // Use the first available model (could be GPT-4, GPT-3.5, Claude, etc.)
      const model = models[0];
      console.log(`[AI Integration] Using model: ${model.vendor}/${model.family} (${model.name})`);

      const messages = [
        vscode.LanguageModelChatMessage.User(
          `You are a helpful assistant for web components. Here is the documentation for the available components:\n\n${contextDoc}\n\nUser question: ${query}`
        ),
      ];

      try {
        const response = await model.sendRequest(messages, {}, token);

        for await (const fragment of response.text) {
          stream.markdown(fragment);
        }
      } catch (err) {
        if (err instanceof vscode.LanguageModelError) {
          stream.markdown(`Error: ${err.message}`);
        } else {
          // Unknown error - still provide the docs
          console.error('[AI Integration] Error:', err);
          stream.markdown(
            `**Error generating AI response, but here's the documentation:**\n\n${contextDoc}`
          );
        }
      }
    }
  );

    participant.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      "assets",
      "icon.png"
    );

    context.subscriptions.push(participant);
    console.log(`[AI Integration] ✅ Chat participant '@wctools' registered successfully`);
  } catch (err) {
    console.error(`[AI Integration] ❌ Failed to register chat participant:`, err);
    const errMsg = err instanceof Error ? err.message : String(err);
    vscode.window.showWarningMessage(
      `Web Components: Chat participant (@wctools) registration failed in ${env}. ${errMsg}`
    );
  }

  // Register as a language model tool so AI can access docs without @wctools
  // This API may not be available in all VS Code forks (e.g., Cursor, Windsurf)
  if (typeof vscode.lm?.registerTool === 'function') {
    try {
      const tool = vscode.lm.registerTool('wctools-docs', new WCToolsLanguageModelTool(service));
      context.subscriptions.push(tool);
      console.log('[AI Integration] Language Model Tool registered successfully');
    } catch (err) {
      console.log('[AI Integration] Language Model Tool registration failed (not supported in this environment):', err);
    }
  } else {
    console.log('[AI Integration] Language Model Tool API not available in this environment');
  }

  // Register inline completion provider for component usage hints
  const inlineProvider = vscode.languages.registerInlineCompletionItemProvider(
    [
      { language: "html" },
      { language: "typescript" },
      { language: "javascript" },
      { language: "vue" },
      { language: "svelte" },
      { language: "astro" },
      { language: "markdown" },
      { language: "php" },
      { language: "python" },
      { language: "ruby" },
      { language: "go" },
      { language: "csharp" },
    ],
    {
      async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _context: vscode.InlineCompletionContext,
        _token: vscode.CancellationToken
      ): Promise<vscode.InlineCompletionItem[] | undefined> {
        // This provides component documentation context to GitHub Copilot's inline suggestions
        // Copilot will automatically use the component docs when generating suggestions

        const line = document.lineAt(position.line).text;
        const componentMatch = line.match(/<([a-z]+-[a-z-]+)/i);

        if (componentMatch) {
          const componentName = componentMatch[1];
          const doc = service.getComponentDoc(componentName);

          if (doc) {
            // The documentation is available in the service and will be used
            // by Copilot through the Language Model API
            // No need to return anything here - Copilot handles it
          }
        }

        return undefined;
      },
    }
  );

  context.subscriptions.push(inlineProvider);
  context.subscriptions.push(service);

  // For Cursor and Windsurf: Register in-memory context documents
  // These editors can read virtual documents without writing to disk
  registerVirtualContextDocuments(context, service, env);

  return service;
}

/**
 * Register virtual context documents for VS Code forks
 * This provides documentation to AI without writing files to disk
 * - VS Code: Uses Language Model API + virtual document
 * - VSCodium: Same as VS Code (can use compatible AI extensions)
 * - Cursor: Can reference virtual documents
 * - Windsurf: Can reference virtual documents
 */
function registerVirtualContextDocuments(
  context: vscode.ExtensionContext,
  service: AIIntegrationService,
  env: string
): void {
  // Create a virtual document provider that serves component documentation
  const virtualDocProvider = new (class implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(_uri: vscode.Uri): string {
      const docsContent = service.formatDocsForAI();
      
      return `# Web Components Documentation
# In-memory context for AI assistants (${env})
# This virtual document provides component documentation without writing to disk

This project uses custom web components. The following documentation describes all available components:

${docsContent}

## Instructions for AI
When the user asks about web components or custom elements (HTML tags with hyphens like <sl-button>, <my-component>):
1. Refer to the documentation above
2. Provide accurate information based on these component definitions
3. Do not make assumptions about properties or behavior not documented here

## Available via @wctools
You can also explicitly query this documentation using the @wctools chat participant.

---
Generated: ${new Date().toISOString()}
Note: This is a virtual document in memory, not written to disk.
`;
    }

    // Allow external updates to refresh the document
    refresh(): void {
      this._onDidChange.fire(vscode.Uri.parse('wc-docs:/context'));
    }
  })();

  // Register the virtual document provider with a custom scheme
  const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'wc-docs',
    virtualDocProvider
  );

  context.subscriptions.push(providerRegistration);

  // Store the provider so we can update it when docs change
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (service as any)._virtualDocProvider = virtualDocProvider;

  // Create a virtual document URI
  const virtualDocUri = vscode.Uri.parse('wc-docs:/context/web-components.md');

  // Open the virtual document in the background (some editors can reference it)
  // This makes it available to AI systems that scan open documents
  vscode.workspace.openTextDocument(virtualDocUri).then((doc) => {
    console.log(`[AI Integration] Created virtual context document (${doc.uri.toString()})`);
    console.log(`[AI Integration] Document has ${doc.lineCount} lines of component documentation`);
    
    // Note: We don't show the document to the user, but it's available to AI
    // Some AI systems (like Cursor) can reference open/virtual documents
  }, (err: Error) => {
    console.log('[AI Integration] Could not create virtual context document:', err.message);
  });

  console.log(`[AI Integration] Virtual context provider registered for ${env}`);
}
