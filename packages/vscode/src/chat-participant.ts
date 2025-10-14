import * as vscode from "vscode";
import { log } from "./utilities";
import { parseQuery, formatQueryResult, QueryResult, ComponentInfo } from "./query-parser";

type ChatResult = Record<string, unknown>;

/**
 * Handle when no documentation is available
 */
function handleNoDocsAvailable(stream: vscode.ChatResponseStream): ChatResult {
  stream.markdown(
    "⚠️ **No component documentation available.**\n\n" +
      "Check that your workspace has a `custom-elements.json` file and the language server is running.\n\n"
  );
  return {};
}

/**
 * Show help message with examples
 */
function showHelpMessage(stream: vscode.ChatResponseStream): ChatResult {
  stream.markdown("### Web Components Assistant 🎨\n\n");
  stream.markdown("Ask me about components in your workspace:\n\n");
  stream.markdown('- "What does `sl-button` do?"\n');
  stream.markdown('- "How can I create a pill button?"\n');
  stream.markdown('- "List all components"\n');
  stream.markdown('- "Compare `sl-button` and `sl-icon-button`"\n\n');
  return {};
}

/**
 * Main chat request handler using simplified query parsing
 */
async function handleChatRequest(
  request: vscode.ChatRequest,
  componentDocs: Record<string, string>,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ChatResult> {
  const query = request.prompt.trim();

  // Early check: if no docs available
  if (Object.keys(componentDocs).length === 0) {
    return handleNoDocsAvailable(stream);
  }

  // Handle help requests
  if (!query || query.toLowerCase().includes('help')) {
    return showHelpMessage(stream);
  }

  try {
    // Use the unified query parser
    const result = parseQuery(query, componentDocs);
    
    if (result.type === 'none') {
      stream.markdown(result.message || 'No components found for your query.');
      return {};
    }

    // Show progress
    stream.progress(result.message || 'Processing query...');

    // Special handling for comparison queries
    if (result.type === 'multiple' && result.components.length === 2 && 
        (query.toLowerCase().includes('compare') || 
         query.toLowerCase().includes('difference') || 
         query.toLowerCase().includes('vs') ||
         query.toLowerCase().includes('between'))) {
      
      return await handleComparisonQuery(result.components, query, stream, token);
    }

    // Special handling for property queries
    if (result.type === 'property' && result.propertyType) {
      return await handlePropertyQuery(result.components, result.propertyType, query, stream, token);
    }

    // Special handling for reasoning queries (component vs HTML element)
    if (result.type === 'reasoning' && result.comparisonTarget) {
      return await handleReasoningQuery(result.components, result.comparisonTarget, query, stream, token);
    }

    // For simple results, show directly
    if (result.type === 'single' || result.type === 'all' || result.components.length <= 3) {
      const formatted = formatQueryResult(result, query);
      stream.markdown(formatted);
      return {
        metadata: {
          type: result.type,
          components: result.components.map(c => c.tagName)
        }
      };
    }

    // For complex queries, use AI assistance
    return await handleComplexQuery(result, query, stream, token);

  } catch (error) {
    stream.markdown(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Handle comparison queries between exactly two components
 */
async function handleComparisonQuery(
  components: ComponentInfo[],
  originalQuery: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ChatResult> {
  
  const [comp1, comp2] = components;
  
  stream.progress(`Comparing ${comp1.tagName} and ${comp2.tagName}...`);

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `The user asked: "${originalQuery}"\n\n` +
      `Please provide a comprehensive comparison between these two web components:\n\n` +
      `## Component 1: ${comp1.tagName}\n\n${comp1.doc}\n\n` +
      `## Component 2: ${comp2.tagName}\n\n${comp2.doc}\n\n` +
      `INSTRUCTIONS: Create a detailed comparison focusing on:\n` +
      `1. **Purpose & Use Cases** - What each component is designed for\n` +
      `2. **Key Differences** - Major functional and design differences\n` +
      `3. **Attributes & Properties** - Compare their customization options\n` +
      `4. **When to Use Each** - Clear guidance on component selection\n` +
      `5. **Code Examples** - Show basic usage of both (if possible)\n\n` +
      `Format your response in clear markdown with headers and bullet points. ` +
      `Be practical and help the user understand which component fits their needs better.`
    ),
  ];

  const chatModels = await vscode.lm.selectChatModels();
  
  if (chatModels.length === 0) {
    // Fallback: show side-by-side documentation
    stream.markdown(`## Comparison: \`${comp1.tagName}\` vs \`${comp2.tagName}\`\n\n`);
    stream.markdown(`### \`${comp1.tagName}\`\n\n${comp1.doc}\n\n`);
    stream.markdown(`### \`${comp2.tagName}\`\n\n${comp2.doc}\n\n`);
    stream.markdown(`💡 *Enable a language model for AI-powered comparison analysis.*\n\n`);
  } else {
    const chatResponse = await chatModels[0].sendRequest(messages, {}, token);
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
  }

  return {
    metadata: {
      type: "comparison",
      components: [comp1.tagName, comp2.tagName],
      query: originalQuery
    }
  };
}

/**
 * Handle property-specific queries for components
 */
async function handlePropertyQuery(
  components: ComponentInfo[],
  propertyType: string,
  originalQuery: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ChatResult> {
  
  if (components.length === 0) {
    stream.markdown('❌ No components found for your property query.');
    return {};
  }

  const component = components[0]; // Focus on the first/main component
  
  stream.progress(`Finding ${propertyType} for ${component.tagName}...`);

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `The user asked: "${originalQuery}"\n\n` +
      `They want to know about the ${propertyType} of the component: ${component.tagName}\n\n` +
      `Here is the component documentation:\n\n${component.doc}\n\n` +
      `INSTRUCTIONS: Extract and present information about the component's ${propertyType}. Focus specifically on:\n` +
      `1. **${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)}** - List all relevant ${propertyType}\n` +
      `2. **Details** - For each ${propertyType.slice(0, -1)}, provide name, type, and description\n` +
      `3. **Usage Examples** - Show practical code examples when possible\n` +
      `4. **Important Notes** - Any special considerations or common patterns\n\n` +
      `If the documentation doesn't clearly show ${propertyType}, say so and suggest where to find this information. ` +
      `Format your response in clear markdown with proper sections and code blocks.`
    ),
  ];

  const chatModels = await vscode.lm.selectChatModels();
  
  if (chatModels.length === 0) {
    // Fallback: show component documentation with focus hint
    stream.markdown(`## ${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)} for \`${component.tagName}\`\n\n`);
    stream.markdown(`${component.doc}\n\n`);
    stream.markdown(`💡 *Enable a language model for AI-powered ${propertyType} extraction.*\n\n`);
  } else {
    const chatResponse = await chatModels[0].sendRequest(messages, {}, token);
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
  }

  return {
    metadata: {
      type: "property",
      propertyType: propertyType,
      component: component.tagName,
      query: originalQuery
    }
  };
}

/**
 * Handle reasoning queries comparing web components to HTML elements
 */
async function handleReasoningQuery(
  components: ComponentInfo[],
  comparisonTarget: string,
  originalQuery: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ChatResult> {
  
  if (components.length === 0) {
    stream.markdown('❌ No components found for your reasoning query.');
    return {};
  }

  const component = components[0]; // Focus on the first/main component
  
  stream.progress(`Analyzing advantages of ${component.tagName} over HTML ${comparisonTarget}...`);

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `The user asked: "${originalQuery}"\n\n` +
      `They want to understand why they should use the web component "${component.tagName}" instead of a standard HTML "${comparisonTarget}" element.\n\n` +
      `Here is the component documentation:\n\n${component.doc}\n\n` +
      `INSTRUCTIONS: Provide a comprehensive comparison explaining the advantages and benefits of using the web component over the standard HTML element. Focus on:\n` +
      `1. **Enhanced Functionality** - What extra features does the web component provide?\n` +
      `2. **Better User Experience** - How does it improve usability, accessibility, or appearance?\n` +
      `3. **Developer Benefits** - Easier APIs, better consistency, reduced code complexity\n` +
      `4. **Styling & Customization** - Advanced theming, CSS custom properties, better control\n` +
      `5. **Accessibility Improvements** - Built-in ARIA support, keyboard navigation, screen reader compatibility\n` +
      `6. **Practical Examples** - Show code comparisons when relevant\n` +
      `7. **When to Use Each** - Scenarios where the web component is clearly better\n\n` +
      `Be practical and help the user understand the real-world benefits. If there are cases where the standard HTML element might be sufficient, mention those too for balanced guidance.`
    ),
  ];

  const chatModels = await vscode.lm.selectChatModels();
  
  if (chatModels.length === 0) {
    // Fallback: show component documentation with reasoning hint
    stream.markdown(`## Why Use \`${component.tagName}\` Instead of HTML \`${comparisonTarget}\`?\n\n`);
    stream.markdown(`### Component Documentation:\n\n${component.doc}\n\n`);
    stream.markdown(`### Key Advantages:\n\n`);
    stream.markdown(`- **Enhanced Functionality**: Web components often provide richer features than basic HTML elements\n`);
    stream.markdown(`- **Better Accessibility**: Built-in ARIA support and keyboard navigation\n`);
    stream.markdown(`- **Consistent Styling**: Unified design system across your application\n`);
    stream.markdown(`- **Easier APIs**: More intuitive properties and methods\n`);
    stream.markdown(`- **Future-Proof**: Part of modern web component standards\n\n`);
    stream.markdown(`💡 *Enable a language model for detailed AI-powered reasoning analysis.*\n\n`);
  } else {
    const chatResponse = await chatModels[0].sendRequest(messages, {}, token);
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
  }

  return {
    metadata: {
      type: "reasoning",
      component: component.tagName,
      comparisonTarget: comparisonTarget,
      query: originalQuery
    }
  };
}

/**
 * Handle complex queries with AI assistance
 */
async function handleComplexQuery(
  result: QueryResult,
  originalQuery: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ChatResult> {
  
  const componentContext = result.components
    .slice(0, 5) // Limit to top 5 for AI processing
    .map((comp: ComponentInfo) => `## ${comp.tagName}\n\n${comp.doc}`)
    .join('\n\n---\n\n');

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `User asked: "${originalQuery}"\n\n` +
      `Based on this query, here are relevant components from their workspace:\n\n` +
      `${componentContext}\n\n` +
      `Please provide a helpful, practical answer. Focus on which components are most suitable ` +
      `and how to use them. Include code examples when possible. Format in markdown.`
    ),
  ];

  const chatModels = await vscode.lm.selectChatModels();
  
  if (chatModels.length === 0) {
    // Fallback: show formatted results without AI
    const formatted = formatQueryResult(result, originalQuery);
    stream.markdown(formatted);
  } else {
    const chatResponse = await chatModels[0].sendRequest(messages, {}, token);
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
  }

  return {
    metadata: {
      type: result.type,
      components: result.components.map((c: ComponentInfo) => c.tagName),
      searchTerm: result.searchTerm
    }
  };
}

/**
 * Register Language Model Tool for Cursor/Copilot integration
 */
function registerLanguageModelTool(
  context: vscode.ExtensionContext,
  componentDocs: Record<string, string>
): void {
  if (!vscode.lm?.registerTool) {
    log("Language Model Tool API not available");
    return;
  }

  const wcToolsTool = vscode.lm.registerTool<{ query: string }>(
    "wctools-docs",
    {
      invoke: async (options) => {
        const query = options.input.query || "";
        log(`Language Model Tool invoked with query: ${query}`);

        if (Object.keys(componentDocs).length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              "No component documentation available. Please ensure the language server has loaded component data."
            ),
          ]);
        }

        const result = parseQuery(query, componentDocs);
        const formattedResult = formatQueryResult(result, query);

        log(`Query result: ${result.type}, ${result.components.length} component(s)`);

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(formattedResult),
        ]);
      },
      prepareInvocation: async (options) => {
        const query = options.input.query || "";
        const result = parseQuery(query, componentDocs);

        return {
          invocationMessage: result.message || `Searching for: ${query}`,
        };
      },
    }
  );

  context.subscriptions.push(wcToolsTool);
  log("Language Model Tool 'wctools-docs' registered");
}

/**
 * Register VS Code Chat Participant
 */
function registerChatParticipantInternal(
  context: vscode.ExtensionContext,
  componentDocs: Record<string, string>
): void {
  if (!vscode.chat?.createChatParticipant) {
    log("Chat API not available - use Language Model Tools instead (wctools-docs).");
    return;
  }

  const participant = vscode.chat.createChatParticipant(
    "wctools",
    async (request, _context, stream, token) => {
      return await handleChatRequest(request, componentDocs, stream, token);
    }
  );

  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "assets", "icon_chat.png");
  context.subscriptions.push(participant);
}

/**
 * Register both Chat Participant (VS Code) and Language Model Tool (Cursor/Copilot)
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  componentDocs: Record<string, string>
): void {
  registerChatParticipantInternal(context, componentDocs);
  registerLanguageModelTool(context, componentDocs);
}
