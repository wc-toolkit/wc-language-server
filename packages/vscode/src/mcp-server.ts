import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CallToolRequest,
  GetPromptRequest,
  ReadResourceRequest,
} from "@modelcontextprotocol/sdk/types.js";
import * as http from "http";
import { parseQuery, formatQueryResult } from "./query-parser.js";

// Simple logger that works both in VS Code and standalone
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [MCP Server] ${message}`);
};

export interface MCPServerOptions {
  /** Transport mode: 'stdio' for process communication, 'http' for HTTP/SSE */
  transport?: "stdio" | "http";
  /** Port to listen on when using HTTP transport */
  port?: number;
  /** Host to bind to when using HTTP transport */
  host?: string;
}

/**
 * Internal MCP server for providing web component information to AI agents
 * This server runs within the VS Code extension and does not reach out to external sources
 */
export class WebComponentMCPServer {
  private server: Server;
  private componentDocs: Record<string, string> = {};
  private options: MCPServerOptions;
  private httpServer?: http.Server;
  private keepAliveIntervals: Map<http.ServerResponse, NodeJS.Timeout> = new Map();

  constructor(options: MCPServerOptions = {}) {
    this.options = {
      transport: options.transport || "stdio",
      port: options.port || 3000,
      host: options.host || "localhost",
    };

    this.server = new Server(
      {
        name: "web-components-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set the component documentation from the language server
   */
  public setComponentDocs(docs: Record<string, string>): void {
    this.componentDocs = docs;
  }

  private setupHandlers(): void {
    // List available prompts
    this.server.setRequestHandler(
      ListPromptsRequestSchema,
      async () => ({
        prompts: [
          {
            name: "component-docs",
            description:
              "Get documentation for all web components in the workspace",
            arguments: [],
          },
          {
            name: "component-info",
            description:
              "Get detailed information about a specific web component",
            arguments: [
              {
                name: "tagName",
                description:
                  "The tag name of the component (e.g., 'sl-button')",
                required: true,
              },
            ],
          },
        ],
      })
    );

    // Handle prompt requests
    this.server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest) => {
        const { name, arguments: args } = request.params;

        if (name === "component-docs") {
          // Return all component documentation from cache
          if (Object.keys(this.componentDocs).length === 0) {
            throw new Error("No component documentation available");
          }

          const allDocs = Object.values(this.componentDocs).join("\n\n---\n\n");

          return {
            description:
              "Documentation for all web components in the workspace",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Here is the documentation for all web components in this workspace:\n\n${allDocs}\n\nYou can now answer questions about these components.`,
                },
              },
            ],
          };
        }

        if (name === "component-info") {
          const tagName = args?.tagName as string;
          if (!tagName) {
            throw new Error("tagName is required");
          }

          const doc = this.componentDocs[tagName];

          return {
            description: `Documentation for ${tagName}`,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: doc,
                },
              },
            ],
          };
        }

        throw new Error(`Unknown prompt: ${name}`);
      }
    );

    // List available tools (simplified set with query tool)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "wctools-docs",
          displayName: "Web Component Docs",
          description:
            "Retrieves comprehensive documentation for custom web components used in this project. This tool uses intelligent query parsing to understand natural language requests. " +
            "ALWAYS use this tool first when the user asks about: component properties/attributes, component usage, component behavior, available components, or any questions mentioning HTML tags with hyphens. " +
            "The tool supports multiple query types: " +
            "1) Specific component lookup: 'sl-button', '<my-component>' " +
            "2) Fuzzy search: 'button' finds all button-related components " +
            "3) Content search: 'components with size attribute' " +
            "4) Comparisons: 'compare sl-button and sl-icon-button' " +
            "5) List all: 'all components', 'list components' " +
            "Simply pass the user's question as-is in the query parameter - the tool will intelligently parse it and return relevant documentation. " +
            "ONLY use this tool for questions directly related to web components in this project.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "The user's question or search query. Can be a component name (e.g., 'sl-button'), partial name (e.g., 'button'), comparison request (e.g., 'compare X and Y'), attribute search (e.g., 'components with size'), or 'all' for everything. The tool intelligently parses natural language.",
              },
            },
            required: ["query"],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        const { arguments: args } = request.params;

        try {
          const query = (args as Record<string, unknown>).query as string;
          if (!query) {
            throw new Error("query is required");
          }

          log(`MCP tool called with query: ${query}`);

          // Use the cached component documentation directly
          if (Object.keys(this.componentDocs).length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "No component documentation available. Please ensure the language server has loaded component data.",
                },
              ],
              isError: true,
            };
          }

          // Use smart query parser to find relevant components
          const result = parseQuery(query, this.componentDocs);
          const formattedResult = formatQueryResult(result, query);

          log(`Query result: ${result.type}, ${result.components.length} component(s)`);

          return {
            content: [
              {
                type: "text",
                text: formattedResult,
              },
            ],
          };
        } catch (error) {
          log(`Error handling tool call: ${error instanceof Error ? error.message : String(error)}`);
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const components = this.componentDocs;
      const resources = [];

      for (const [tagName, description] of Object.entries(components)) {
        resources.push({
          uri: `wc://component/${tagName}`,
          name: `Component: ${tagName}`,
          description: description || "Web component definition",
          mimeType: "text/markdown",
        });
      }

      return {
        resources,
      };
    });

    // Read resource content
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: ReadResourceRequest) => {
        const uri = request.params.uri;

        if (uri.startsWith("wc://component/")) {
          const tagName = uri.replace("wc://component/", "");
          const documentation =
            this.componentDocs[tagName] ||
            `# Component not found: ${tagName}`;

          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: documentation,
              },
            ],
          };
        }
        throw new Error(`Unknown resource URI: ${uri}`);
      }
    );
  }

  /**
   * Starts the MCP server with the configured transport
   */
  public async start(): Promise<void> {
    if (this.options.transport === "http") {
      await this.startHttpServer();
    } else {
      await this.startStdioServer();
    }
  }

  /**
   * Starts the MCP server with stdio transport
   */
  private async startStdioServer(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    log("MCP server started with stdio transport");
  }

  /**
   * Sets CORS headers on the response
   */
  private setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  /**
   * Handles OPTIONS preflight requests
   */
  private handleOptionsRequest(res: http.ServerResponse): void {
    res.writeHead(200);
    res.end();
  }

  /**
   * Handles the /health endpoint
   */
  private handleHealthCheck(res: http.ServerResponse): void {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        componentsLoaded: Object.keys(this.componentDocs).length,
      })
    );
  }

  /**
   * Handles the /sse endpoint for Server-Sent Events
   */
  private async handleSseConnection(res: http.ServerResponse): Promise<void> {
    log("SSE connection established");

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send keep-alive comments every 15 seconds to prevent timeout
    const keepAliveInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": keep-alive\n\n");
      } else {
        clearInterval(keepAliveInterval);
        this.keepAliveIntervals.delete(res);
      }
    }, 15000);

    this.keepAliveIntervals.set(res, keepAliveInterval);

    // Clean up when connection closes
    res.on("close", () => {
      log("SSE connection closed");
      const interval = this.keepAliveIntervals.get(res);
      if (interval) {
        clearInterval(interval);
        this.keepAliveIntervals.delete(res);
      }
    });

    const transport = new SSEServerTransport("/message", res);
    await this.server.connect(transport);
  }

  /**
   * Handles the /message endpoint for receiving client messages
   */
  private handleMessageRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    let body = "";
    
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        // Parse and handle the JSON-RPC message
        const message = JSON.parse(body);
        log(`Received message: ${JSON.stringify(message)}`);

        // The transport handles the actual message processing
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: true }));
      } catch (error) {
        log(`Error processing message: ${error}`);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Invalid JSON",
          })
        );
      }
    });
  }

  /**
   * Handles 404 Not Found responses
   */
  private handleNotFound(res: http.ServerResponse): void {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }

  /**
   * Routes incoming HTTP requests to the appropriate handler
   */
  private async routeRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    this.setCorsHeaders(res);

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      this.handleOptionsRequest(res);
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Route to appropriate handler
    if (url.pathname === "/health" && req.method === "GET") {
      this.handleHealthCheck(res);
    } else if (url.pathname === "/sse" && req.method === "GET") {
      // SSE connections should not timeout
      req.socket.setTimeout(0);
      await this.handleSseConnection(res);
    } else if (url.pathname === "/message" && req.method === "POST") {
      this.handleMessageRequest(req, res);
    } else {
      this.handleNotFound(res);
    }
  }

  /**
   * Starts the MCP server with HTTP/SSE transport using Node.js built-in http module
   */
  private async startHttpServer(): Promise<void> {
    this.httpServer = http.createServer((req, res) => {
      this.routeRequest(req, res).catch((error) => {
        log(`Error handling request: ${error}`);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      });
    });

    // Set longer timeout for SSE connections (0 = no timeout)
    this.httpServer.setTimeout(0);
    this.httpServer.keepAliveTimeout = 0;

    return new Promise<void>((resolve, reject) => {
      // Add error handler for EADDRINUSE and other errors
      const errorHandler = (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          log(
            `Port ${this.options.port} is already in use. MCP server could not start.`
          );
          log(
            `Try changing the port in settings (wctools.mcp.port) or restart VS Code.`
          );
        } else {
          log(`MCP HTTP server error: ${error.message}`);
        }
        reject(error);
      };

      this.httpServer!.once("error", errorHandler);

      this.httpServer!.listen(
        this.options.port,
        this.options.host,
        () => {
          // Remove the error handler since we're now listening successfully
          this.httpServer!.removeListener("error", errorHandler);
          
          // Add a persistent error handler for runtime errors
          this.httpServer!.on("error", (error: NodeJS.ErrnoException) => {
            log(`MCP HTTP server runtime error: ${error.message}`);
          });

          log(
            `MCP server started with HTTP/SSE transport on http://${this.options.host}:${this.options.port}`
          );
          log(
            `Connect using: http://${this.options.host}:${this.options.port}/sse`
          );
          resolve();
        }
      );
    });
  }

  /**
   * Closes the MCP server
   */
  public async close(): Promise<void> {
    // Clear all keep-alive intervals
    for (const [res, interval] of this.keepAliveIntervals.entries()) {
      clearInterval(interval);
      if (!res.writableEnded) {
        res.end();
      }
    }
    this.keepAliveIntervals.clear();

    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          log("MCP server close timeout, forcing shutdown");
          resolve();
        }, 5000);

        this.httpServer?.close((err) => {
          clearTimeout(timeout);
          if (err) {
            log(`Error closing MCP server: ${err.message}`);
            reject(err);
          } else {
            log("MCP HTTP server closed");
            resolve();
          }
        });

        // Destroy all active connections immediately
        this.httpServer?.closeAllConnections?.();
      });
      this.httpServer = undefined;
    }
    await this.server.close();
    log("MCP server closed");
  }
}

// For standalone execution (when run as a separate process)
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const transportIndex = args.indexOf("--transport");
  const portIndex = args.indexOf("--port");
  const hostIndex = args.indexOf("--host");

  const options: MCPServerOptions = {
    transport:
      transportIndex >= 0
        ? (args[transportIndex + 1] as "stdio" | "http")
        : "stdio",
    port: portIndex >= 0 ? parseInt(args[portIndex + 1]) : 3000,
    host: hostIndex >= 0 ? args[hostIndex + 1] : "localhost",
  };

  const server = new WebComponentMCPServer(options);
  server.start().catch((error) => {
    log("Failed to start MCP server: " + error.message);
    process.exit(1);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log("Shutting down MCP server...");
    await server.close();
    process.exit(0);
  });
}
