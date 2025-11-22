# Zed vs VS Code Extension Comparison

## Architecture Comparison

### VS Code Extension (`packages/vscode`)

**Language:** TypeScript  
**Build System:** esbuild  
**Distribution:** `.vsix` package via VS Code Marketplace  
**Size:** ~500KB compiled

**Main Components:**

- `extension.ts` - Main activation and lifecycle
- `chat-participant.ts` - GitHub Copilot Chat integration
- `mcp-server.ts` - Model Context Protocol server
- `query-parser.ts` - AI query parsing
- `utilities.ts` - Client creation and management

### Zed Extension (`packages/zed`)

**Language:** Rust  
**Build System:** Cargo (compiles to WebAssembly)  
**Distribution:** Via Zed Extensions repository  
**Size:** ~200KB compiled WASM

**Main Components:**

- `src/lib.rs` - All extension logic in one file
- Rust trait implementations for Zed Extension API
- WebAssembly binary for sandboxed execution

## Feature Comparison

### Core Language Server Features

| Feature          | VS Code        | Zed           | Implementation             |
| ---------------- | -------------- | ------------- | -------------------------- |
| LSP Client       | ✅ Volar-based | ✅ Native Zed | Different client libraries |
| Auto-completion  | ✅             | ✅            | Same language server       |
| Hover            | ✅             | ✅            | Same language server       |
| Diagnostics      | ✅             | ✅            | Same language server       |
| Go to Definition | ✅             | ✅            | Same language server       |
| Configuration    | ✅             | ✅            | Different settings APIs    |
| Multi-language   | ✅             | ✅            | Same language server       |

### UI/UX Features

| Feature         | VS Code            | Zed                | Notes                          |
| --------------- | ------------------ | ------------------ | ------------------------------ |
| Custom Labels   | ✅ `CodeLabel` API | ✅ `CodeLabel` API | Similar API                    |
| Output Channel  | ✅                 | ✅ Logs            | Different logging              |
| Status Messages | ✅                 | ✅                 | Different notification APIs    |
| Commands        | ✅                 | ✅                 | Different command registration |

### AI/Copilot Features

| Feature             | VS Code | Zed | Notes                           |
| ------------------- | ------- | --- | ------------------------------- |
| Chat Participant    | ✅      | ❌  | VS Code specific                |
| Language Model Tool | ✅      | ❌  | VS Code specific                |
| MCP Server          | ✅      | ❌  | Could be separate Zed extension |
| Query Parser        | ✅      | ❌  | Not needed in Zed core          |
| Slash Commands      | ❌      | 🔜  | Zed native feature (future)     |
| Context Server      | ❌      | 🔜  | Zed native feature (future)     |

### Configuration & Setup

| Feature                       | VS Code | Zed | Differences    |
| ----------------------------- | ------- | --- | -------------- |
| Auto-restart on config change | ✅      | ✅  | Both support   |
| File watchers                 | ✅      | ✅  | Different APIs |
| Settings UI                   | ✅      | ✅  | Different UIs  |
| Workspace config              | ✅      | ✅  | Same concept   |

## Code Comparison

### VS Code: Language Client Creation

```typescript
// extension.ts
const client = new LanguageClient(
  "wcLanguageServer",
  "Web Components Language Server",
  serverOptions,
  clientOptions
);
await client.start();
```

### Zed: Language Server Command

```rust
// lib.rs
impl zed::Extension for WebComponentsExtension {
    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        Ok(zed::Command {
            command: binary_path,
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        })
    }
}
```

## AI Features Detail

### VS Code Chat Participant

```typescript
// chat-participant.ts
const participant = vscode.chat.createChatParticipant(
  "wctools",
  async (request, context, stream, token) => {
    // Process query, search components
    // Return formatted markdown
  }
);
```

**Features:**

- Natural language queries
- Component search and comparison
- Property-specific queries
- AI-powered explanations
- Integration with GitHub Copilot

**Not in Zed Extension:**

- Zed has different AI integration model
- Could be added as Slash Command extension
- Would require separate Zed extension

### VS Code MCP Server

```typescript
// mcp-server.ts
export class WebComponentMCPServer {
  // HTTP/SSE or stdio transport
  // Exposes component docs to AI agents
  // Resources, Tools, Prompts
}
```

**Features:**

- Standalone MCP server
- HTTP/SSE or stdio transport
- AI agent integration
- Component documentation as resources
- Query tool for components

**Not in Zed Extension:**

- Zed has built-in MCP support
- Could be registered via extension.toml
- Would use Zed's MCP server extension API

### Potential Zed AI Extensions

**Future Slash Command Extension:**

```rust
// Future: packages/zed-slash-commands/src/lib.rs
impl SlashCommand for ComponentQuery {
    fn run(&self, args: &str) -> String {
        // Query components
        // Return documentation
    }
}
```

**Future Context Server:**

```toml
# extension.toml
[context_servers.web-components]
command = "wc-context-server"
```

## File Structure Comparison

### VS Code (`packages/vscode`)

```
vscode/
├── package.json          # NPM package, VS Code manifest
├── src/
│   ├── extension.ts     # Main entry
│   ├── chat-participant.ts
│   ├── mcp-server.ts
│   ├── query-parser.ts
│   └── utilities.ts
├── scripts/
│   └── build.js         # esbuild script
└── dist/                # Compiled JS
```

### Zed (`packages/zed`)

```
zed/
├── extension.toml       # Zed extension manifest
├── Cargo.toml          # Rust package
├── package.json        # For language server dep
├── src/
│   └── lib.rs          # All extension code
├── build.sh            # Build script
└── target/             # Compiled WASM
```

## Extension Lifecycle

### VS Code

1. Extension activated on language open
2. Language client starts
3. Language server process spawns
4. Client connects via IPC
5. Chat participant registers
6. MCP server starts (if enabled)

### Zed

1. Extension compiled to WASM
2. Loaded into Zed sandbox
3. Language server command requested
4. Server process spawns
5. Connects via stdio
6. No additional components

## Performance

### VS Code

- **Bundle size:** ~500KB JavaScript
- **Memory:** ~50-100MB (Node.js language server + extension)
- **Startup:** ~500ms
- **Runtime:** Node.js process overhead

### Zed

- **Bundle size:** ~200KB WASM
- **Memory:** ~30-50MB (language server only)
- **Startup:** ~200ms
- **Runtime:** Sandboxed WASM (more secure, potentially faster)

## Development Experience

### VS Code

- **Language:** TypeScript (familiar to web devs)
- **Build time:** ~1-2 seconds (esbuild)
- **Hot reload:** ✅ With watch mode
- **Debugging:** ✅ Full Chrome DevTools
- **Testing:** Node test runner

### Zed

- **Language:** Rust (steeper learning curve)
- **Build time:** ~5-10 seconds (cargo)
- **Hot reload:** ✅ Extension reload command
- **Debugging:** `println!` + `zed --foreground`
- **Testing:** Rust tests

## When to Use Each

### VS Code Extension Better For:

- Projects already using VS Code
- Need Chat/Copilot integration
- Want MCP server functionality
- Prefer TypeScript development
- Need extensive customization

### Zed Extension Better For:

- Projects using Zed IDE
- Want faster, lighter extension
- Prefer native-feeling integration
- Value security (WASM sandbox)
- Simpler codebase

## Migration Path

If migrating from VS Code to Zed:

1. ✅ Core LSP features work identically
2. ✅ Same language server, same experience
3. ❌ Chat features not available (yet)
4. ❌ MCP server not included (could add)
5. 🔜 Wait for Zed Slash Commands support

## Conclusion

Both extensions provide excellent web component support with the same core functionality. The VS Code extension has more AI features, while the Zed extension is lighter and more integrated. Choose based on your IDE preference - the development experience will be great in either editor.
