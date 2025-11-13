# Getting Started with JetBrains Plugin Development

This guide will help you set up and develop the Web Components JetBrains plugin.

## Prerequisites

- **JDK 17 or later** - Download from [Adoptium](https://adoptium.net/)
- **IntelliJ IDEA** (Community or Ultimate) - For development
- **Node.js** - For the language server

## Setup

1. **Open the project in IntelliJ IDEA:**
   ```bash
   cd packages/jetbrains
   idea .
   ```
   Or use **File → Open** and select the `packages/jetbrains` folder.

2. **Gradle will automatically sync**. If not, click the Gradle icon in the toolbar.

## Development Workflow

### Running the Plugin

To test the plugin in a sandboxed IDE:

```bash
./gradlew runIde
```

This launches a new IntelliJ IDEA instance with your plugin installed.

### Building

To build the plugin JAR:

```bash
./gradlew buildPlugin
```

The plugin will be in `build/distributions/`.

### Testing

Run tests:

```bash
./gradlew test
```

### Code Structure

```
src/main/kotlin/com/wctoolkit/
├── actions/           # User actions (restart server, check docs)
├── listeners/         # Event listeners (project close)
├── services/          # Core services
│   ├── WCLanguageServerService.kt    # LSP server management
│   ├── WCLanguageClient.kt           # LSP client
│   ├── ConfigWatcherService.kt       # File watching
│   └── ManifestLoaderService.kt      # Documentation loading
├── settings/          # Plugin settings UI
│   ├── WCToolsSettings.kt
│   ├── WCToolsConfigurable.kt
│   └── WCToolsSettingsComponent.kt
└── startup/           # Initialization
    └── WCLanguageServerStartupActivity.kt
```

## Next Steps

### TODO: Complete LSP Integration

The current implementation has basic LSP client setup but needs:

1. **Full LSP initialization** - Send proper initialize request
2. **Document synchronization** - Track open files
3. **Autocomplete** - Wire up LSP completion to IntelliJ's completion API
4. **Hover** - Show documentation on hover
5. **Diagnostics** - Display errors/warnings as IntelliJ annotations

### Example: Adding Autocomplete

```kotlin
// Add to a new file: com/wctoolkit/completion/WCCompletionContributor.kt
class WCCompletionContributor : CompletionContributor() {
    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet
                ) {
                    // Get LSP completions and add to result
                }
            }
        )
    }
}
```

Register in `plugin.xml`:
```xml
<extensions defaultExtensionNs="com.intellij">
    <completion.contributor 
        language="HTML"
        implementationClass="com.wctoolkit.completion.WCCompletionContributor"/>
</extensions>
```

## Publishing

### To JetBrains Marketplace

1. Create an account at [JetBrains Marketplace](https://plugins.jetbrains.com/)
2. Set your token:
   ```bash
   export PUBLISH_TOKEN=your-token-here
   ```
3. Publish:
   ```bash
   ./gradlew publishPlugin
   ```

## Resources

- [IntelliJ Platform SDK](https://plugins.jetbrains.com/docs/intellij/)
- [LSP4J Documentation](https://github.com/eclipse/lsp4j)
- [Plugin Development Forum](https://intellij-support.jetbrains.com/hc/en-us/community/topics/200366979-IntelliJ-IDEA-Open-API-and-Plugin-Development)

## Tips

- **Use DevKit** - IntelliJ has a DevKit plugin for plugin development
- **Enable Internal Mode** - Help → Edit Custom Properties → add `idea.is.internal=true`
- **Check Logs** - Help → Show Log in Finder/Explorer
- **Profile Performance** - Use YourKit integration if available
