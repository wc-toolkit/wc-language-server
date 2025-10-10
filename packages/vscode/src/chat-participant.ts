import * as vscode from "vscode";
import { log } from "./utilities";

/**
 * Chat participant for web components
 * Provides component information directly in Copilot Chat using fetchedDocs
 * Enhanced with natural language query parsing and tailored responses
 */

/**
 * Find component tag name in query
 */
function findComponentInQuery(prompt: string): string | null {
  // Try various patterns to extract component name
  const patterns = [
    /[`<]([a-z]+-[a-z0-9-]+)[>`]/i,  // `sl-button` or <sl-button>
    /\b([a-z]+-[a-z0-9-]+)\b/i,      // sl-button
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

type ChatResult = Record<string, unknown>;

/**
 * Handle the case when no documentation is available
 */
function handleNoDocsAvailable(stream: vscode.ChatResponseStream): ChatResult {
  stream.markdown(
    "⚠️ **No component documentation is available yet.**\n\n" +
    "This could mean:\n" +
    "1. The language server is still loading\n" +
    "2. No `custom-elements.json` file was found in your workspace\n" +
    "3. The language server needs to be restarted\n\n" +
    "Please wait a moment and try again, or check the Output panel " +
    "(View → Output → Web Components Language Server) for more details.\n\n"
  );
  return {};
}

/**
 * Handle comparison queries between two components
 */
async function handleComparisonQuery(
  originalPrompt: string,
  componentDocs: Record<string, string>,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ChatResult | null> {
  const tagMatches = originalPrompt.match(/[`<]?([a-z]+-[a-z0-9-]+)[>`]?/gi);

  if (!tagMatches || tagMatches.length < 2) {
    return null;
  }

  const tags = tagMatches.slice(0, 2).map((t) => t.replace(/[`<>]/g, ""));
  const [tag1, tag2] = tags;

  if (!componentDocs[tag1] || !componentDocs[tag2]) {
    return null;
  }

  stream.progress(`Comparing ${tag1} and ${tag2}...`);

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `The user asked: "${originalPrompt}"\n\n` +
      `Here is the documentation for <${tag1}>:\n\n${componentDocs[tag1]}\n\n` +
      `Here is the documentation for <${tag2}>:\n\n${componentDocs[tag2]}\n\n` +
      `Please provide a friendly, comprehensive comparison of these two components. ` +
      `Highlight their key differences, use cases, and help the user understand when to use each one. ` +
      `Format your response in markdown.`
    )
  ];

  const chatModels = await vscode.lm.selectChatModels();

  if (chatModels.length === 0) {
    stream.markdown("⚠️ No language model available. Showing raw documentation:\n\n");
    stream.markdown(`## \`<${tag1}>\`\n\n${componentDocs[tag1]}\n\n`);
    stream.markdown(`## \`<${tag2}>\`\n\n${componentDocs[tag2]}\n\n`);
    return {};
  }

  const chatResponse = await chatModels[0].sendRequest(messages, {}, token);
  for await (const fragment of chatResponse.text) {
    stream.markdown(fragment);
  }

  return {};
}

/**
 * Handle listing all available components
 */
function handleListComponents(
  componentDocs: Record<string, string>,
  stream: vscode.ChatResponseStream
): ChatResult {
  stream.progress("Fetching web components...");
  const componentNames = Object.keys(componentDocs);

  if (componentNames.length === 0) {
    stream.markdown(
      "No web components found in this workspace. Make sure you have a `custom-elements.json` file.\n\n"
    );
    return {};
  }

  stream.markdown(
    `Found **${componentNames.length}** web component${componentNames.length !== 1 ? "s" : ""}:\n\n`
  );

  for (const tagName of componentNames) {
    const doc = componentDocs[tagName];
    const descMatch = doc.match(/^#[^\n]+\n+([^\n]+)/m);
    const description = descMatch ? descMatch[1].trim() : "";

    stream.markdown(
      `- \`<${tagName}>\`${description ? ` - ${description}` : ""}\n`
    );
  }
  stream.markdown("\n");

  return {};
}

/**
 * Handle component-specific queries with language model assistance
 */
async function handleComponentQuery(
  tagName: string,
  originalPrompt: string,
  componentDocs: Record<string, string>,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ChatResult> {
  stream.progress(`Looking up ${tagName}...`);
  const doc = componentDocs[tagName];

  stream.markdown(`## 📚 \`<${tagName}>\` (from your workspace)\n\n`);

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `The user asked: "${originalPrompt}"\n\n` +
      `Here is the complete documentation for the <${tagName}> web component:\n\n${doc}\n\n` +
      `IMPORTANT: Use the documentation provided above to answer the question. ` +
      `Do NOT make assumptions. ` +
      `If the documentation doesn't contain the answer, say so explicitly. ` +
      `Please provide a helpful, user-friendly response to their question. ` +
      `Extract and present the most relevant information from the documentation. ` +
      `Be concise but thorough. Format your response in markdown. ` +
      `If they're asking about specific features (attributes, events, slots, methods, etc.), ` +
      `focus on those sections while providing helpful context.`
    )
  ];

  const chatModels = await vscode.lm.selectChatModels();

  if (chatModels.length === 0) {
    stream.markdown(doc);
    stream.markdown("\n");
    return {};
  }

  const chatResponse = await chatModels[0].sendRequest(messages, {}, token);
  for await (const fragment of chatResponse.text) {
    stream.markdown(fragment);
  }

  stream.markdown("\n\n---\n*Information from Custom Elements Manifest in your workspace*\n");

  return {
    metadata: {
      command: "componentInfo",
      component: tagName
    }
  };
}

/**
 * Handle when a component is not found
 */
function handleComponentNotFound(
  tagName: string,
  componentDocs: Record<string, string>,
  stream: vscode.ChatResponseStream
): ChatResult {
  stream.markdown(
    `Component \`<${tagName}>\` not found in this workspace.\n\n`
  );

  // Suggest similar components
  const similarComponents = Object.keys(componentDocs).filter(
    (name) =>
      name.includes(tagName.split("-")[0]) ||
      name.includes(tagName.split("-")[1] || "")
  );

  if (similarComponents.length > 0) {
    stream.markdown("Did you mean:\n");
    for (const similar of similarComponents.slice(0, 3)) {
      stream.markdown(`- \`<${similar}>\`\n`);
    }
    stream.markdown("\n");
  }

  stream.markdown(
    "Make sure:\n" +
    "1. The component is defined in your `custom-elements.json`\n" +
    "2. The language server has loaded the manifest\n\n"
  );
  return {};
}

/**
 * Handle search queries
 */
function handleSearchQuery(
  prompt: string,
  componentDocs: Record<string, string>,
  stream: vscode.ChatResponseStream
): ChatResult {
  const query = prompt
    .replace(/search|find|for|component|web component/gi, "")
    .trim();

  if (!query) {
    stream.markdown("Please provide a search term.\n\n");
    return {};
  }

  stream.progress(`Searching for "${query}"...`);

  const results: string[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [tagName, doc] of Object.entries(componentDocs)) {
    if (
      tagName.toLowerCase().includes(lowerQuery) ||
      doc.toLowerCase().includes(lowerQuery)
    ) {
      results.push(tagName);
    }
  }

  if (results.length === 0) {
    stream.markdown(`No components found matching "${query}".\n\n`);
    return {};
  }

  stream.markdown(
    `Found **${results.length}** component(s) matching "${query}":\n\n`
  );
  for (const tagName of results) {
    const doc = componentDocs[tagName];
    const descMatch = doc.match(/^#[^\n]+\n+([^\n]+)/m);
    const description = descMatch ? descMatch[1].trim() : "";

    stream.markdown(
      `- \`<${tagName}>\`${description ? ` - ${description}` : ""}\n`
    );
  }
  stream.markdown("\n");

  return {};
}

/**
 * Show default help message
 */
function showHelpMessage(stream: vscode.ChatResponseStream): ChatResult {
  stream.markdown("### Web Components Assistant 🎨\n\n");
  stream.markdown(
    "I can help you with web components in your workspace. Try asking:\n\n"
  );

  stream.markdown("**Quick Information:**\n");
  stream.markdown('- "What does `sl-button` do?"\n');
  stream.markdown('- "Describe `sl-dialog`"\n');
  stream.markdown('- "Tell me about `sl-input`"\n\n');

  stream.markdown("**Specific Details:**\n");
  stream.markdown('- "What attributes does `sl-dialog` have?"\n');
  stream.markdown('- "What events does `sl-button` emit?"\n');
  stream.markdown('- "Show me the slots for `sl-card`"\n');
  stream.markdown('- "What methods does `sl-drawer` have?"\n');
  stream.markdown('- "CSS parts for `sl-button`"\n\n');

  stream.markdown("**Usage & Examples:**\n");
  stream.markdown('- "How do I use `sl-dialog`?"\n');
  stream.markdown('- "Show me an example of `sl-button`"\n\n');

  stream.markdown("**Discovery:**\n");
  stream.markdown('- "List all components"\n');
  stream.markdown('- "Search for card components"\n');
  stream.markdown('- "Compare `sl-button` and `sl-icon-button`"\n\n');

  stream.markdown(
    "💡 I'll provide tailored information from your Custom Elements Manifest documentation!\n\n"
  );

  return {};
}

/**
 * Main chat request handler
 */
async function handleChatRequest(
  request: vscode.ChatRequest,
  componentDocs: Record<string, string>,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<Record<string, unknown>> {
  const prompt = request.prompt.toLowerCase();
  const originalPrompt = request.prompt;

  // Early check: if no docs available, inform user
  if (Object.keys(componentDocs).length === 0 && !prompt.includes("help")) {
    return handleNoDocsAvailable(stream);
  }

  try {
    // Find component in query (check early for optimization)
    const tagName = findComponentInQuery(originalPrompt);

    // Handle comparison queries (multiple components)
    if (
      prompt.includes("compare") ||
      prompt.includes("difference") ||
      prompt.includes(" vs ")
    ) {
      const result = await handleComparisonQuery(originalPrompt, componentDocs, stream, token);
      if (result !== null) {
        return result;
      }
    }

    // List all components
    if (
      prompt.includes("list") ||
      prompt.includes("what components") ||
      prompt.includes("show components") ||
      prompt.includes("available")
    ) {
      return handleListComponents(componentDocs, stream);
    }

    // Handle component-specific queries with language model
    if (tagName && componentDocs[tagName]) {
      return await handleComponentQuery(tagName, originalPrompt, componentDocs, stream, token);
    }

    // Component not found
    if (tagName) {
      return handleComponentNotFound(tagName, componentDocs, stream);
    }

    // Search
    if (prompt.includes("search") || prompt.includes("find")) {
      return handleSearchQuery(prompt, componentDocs, stream);
    }

    // Default help
    return showHelpMessage(stream);
  } catch (error) {
    stream.markdown(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}\n\n`
    );
    return {};
  }
}

/**
 * Registers the Language Model Tool for Cursor/Copilot integration
 */
function registerLanguageModelTool(
  context: vscode.ExtensionContext,
  componentDocs: Record<string, string>
): void {
  if (!vscode.lm || !vscode.lm.registerTool) {
    log("Language Model Tool API not available");
    return;
  }

  const wcToolsTool = vscode.lm.registerTool<{ query: string }>(
    "wctools-docs",
    {
      invoke: async (
        options: vscode.LanguageModelToolInvocationOptions<{ query: string }>
      ) => {
        const query = options.input.query?.toLowerCase() || "";
        log(`Language Model Tool invoked with query: ${query}`);

        let resultContent: string;

        // Handle "all" query
        if (query === "all") {
          const allDocs = Object.entries(componentDocs)
            .map(([tag, doc]) => `## Component: ${tag}\n\n${doc}`)
            .join("\n\n---\n\n");

          resultContent =
            allDocs || "No component documentation available yet.";
        } else {
          // Find specific component
          const componentName = query.trim();

          if (componentDocs[componentName]) {
            resultContent = componentDocs[componentName];
          } else {
            // Try to find similar components
            const similarComponents = Object.keys(componentDocs).filter(
              (name) =>
                name.includes(componentName) || componentName.includes(name)
            );

            if (similarComponents.length > 0) {
              resultContent = similarComponents
                .map((tag) => `## Component: ${tag}\n\n${componentDocs[tag]}`)
                .join("\n\n---\n\n");
            } else {
              // No matches found
              const availableComponents =
                Object.keys(componentDocs).join(", ");
              resultContent = `Component "${componentName}" not found. Available components: ${availableComponents || "none"}`;
            }
          }
        }

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(resultContent),
        ]);
      },
      prepareInvocation: async (
        options: vscode.LanguageModelToolInvocationPrepareOptions<{
          query: string;
        }>,
      ) => {
        const query = options.input.query?.toLowerCase() || "";
        const componentName = query.trim();

        let message: string;
        if (query === "all") {
          message = `Retrieving documentation for all ${Object.keys(componentDocs).length} components`;
        } else if (componentDocs[componentName]) {
          message = `Retrieving documentation for ${componentName}`;
        } else {
          message = `Searching for component: ${componentName}`;
        }

        return {
          invocationMessage: message,
        };
      },
    }
  );

  context.subscriptions.push(wcToolsTool);
  log("Language Model Tool 'wctools-docs' registered");
}

/**
 * Registers the Chat Participant for VS Code native chat
 */
function registerChatParticipantInternal(
  context: vscode.ExtensionContext,
  componentDocs: Record<string, string>
): void {
  // Check if the Chat API is available (VS Code 1.90+)
  // Note: Cursor does not support this API - it uses Language Model Tools instead
  if (!vscode.chat || !vscode.chat.createChatParticipant) {
    log(
      "[wctools] Chat API not available - this is expected in Cursor. Use Language Model Tools instead (wctools-docs)."
    );
    return;
  }

  const participant = vscode.chat.createChatParticipant(
    "wctools",
    async (
      request: vscode.ChatRequest,
      _context: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ) => {
      return await handleChatRequest(request, componentDocs, stream, token);
    }
  );

  participant.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "assets",
    "icon.png"
  );

  context.subscriptions.push(participant);
}

/**
 * Registers both the Chat Participant (VS Code) and Language Model Tool (Cursor/Copilot)
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  componentDocs: Record<string, string>
): void {
  // Register VS Code Chat Participant
  registerChatParticipantInternal(context, componentDocs);
  
  // Register Language Model Tool for Cursor/Copilot
  registerLanguageModelTool(context, componentDocs);
}
