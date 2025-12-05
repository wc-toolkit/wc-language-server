package com.wctoolkit.webcomponents

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServer
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import com.wctoolkit.webcomponents.settings.WCSettings
import java.io.File
import java.nio.file.Path

/**
 * Language Server Protocol support provider for Web Components
 * This class configures and starts the Web Components Language Server
 */
class WCLanguageServerProvider : LspServerSupportProvider {
    override fun fileOpened(
        project: Project,
        file: VirtualFile,
        serverStarter: LspServerSupportProvider.LspServerStarter
    ) {
        // Start the server for any file
        println("Starting server for: ${file.name}")
        serverStarter.ensureServerStarted(WCLanguageServerDescriptor(project))
    }
}

/**
 * Descriptor for the Web Components Language Server
 */
class WCLanguageServerDescriptor(project: Project) : ProjectWideLspServerDescriptor(project, "Web Components") {
    
    override fun isSupportedFile(file: VirtualFile): Boolean {
        // Support all file types
        return true
    }

    override fun createCommandLine(): GeneralCommandLine {
        val settings = WCSettings.getInstance()
        
        // Get the language server executable path from plugin resources
        val pluginId = PluginId.getId("com.wc-toolkit.web-components-language-server")
        val plugin = PluginManagerCore.getPlugin(pluginId)
            ?: throw IllegalStateException("Plugin not found: com.wc-toolkit.web-components-language-server")
        
        val pluginPath = plugin.pluginPath
        
        // Determine the correct executable based on OS
        val osName = System.getProperty("os.name").lowercase()
        val executableName = when {
            osName.contains("windows") -> "wc-language-server-windows-x64.exe"
            osName.contains("mac") || osName.contains("darwin") -> {
                val arch = System.getProperty("os.arch").lowercase()
                if (arch.contains("aarch64") || arch.contains("arm64")) {
                    "wc-language-server-macos-arm64"
                } else {
                    "wc-language-server-macos-x64"
                }
            }
            else -> { // Linux and other Unix-like systems
                val arch = System.getProperty("os.arch").lowercase()
                if (arch.contains("aarch64") || arch.contains("arm64")) {
                    "wc-language-server-linux-arm64"
                } else {
                    "wc-language-server-linux-x64"
                }
            }
        }
        
        val serverExecutable = pluginPath.resolve("language-server/bin/$executableName").toFile()
        
        if (!serverExecutable.exists()) {
            throw IllegalStateException(
                "Language server executable not found at: ${serverExecutable.absolutePath}\n" +
                "Expected executable: $executableName\n" +
                "Please ensure the plugin is properly installed.\n" +
                "Plugin path: $pluginPath"
            )
        }
        
        // Build the command line
        val commandLine = GeneralCommandLine()
            .withExePath(serverExecutable.absolutePath)
            .withParameters("--stdio")
            .withWorkDirectory(project.basePath)
            .withCharset(Charsets.UTF_8)
        
        // Add environment variables if needed
        commandLine.environment.putAll(System.getenv())
        
        return commandLine
    }
    
    /**
     * Find the Node.js executable in the system PATH or configured location
     */
    private fun findNodeExecutable(): String? {
        val settings = WCSettings.getInstance()
        
        // First, try the configured path
        if (settings.nodePath.isNotBlank()) {
            val configuredNode = File(settings.nodePath)
            if (configuredNode.exists() && configuredNode.canExecute()) {
                return configuredNode.absolutePath
            }
        }
        
        // Try to find node in PATH
        val nodeCommands = if (System.getProperty("os.name").lowercase().contains("win")) {
            listOf("node.exe", "node.cmd", "node")
        } else {
            listOf("node")
        }
        
        val pathEnv = System.getenv("PATH") ?: return null
        val paths = pathEnv.split(File.pathSeparator)
        
        for (path in paths) {
            for (nodeCommand in nodeCommands) {
                val nodeFile = File(path, nodeCommand)
                if (nodeFile.exists() && nodeFile.canExecute()) {
                    return nodeFile.absolutePath
                }
            }
        }
        
        return null
    }

    override val lspGoToDefinitionSupport: Boolean = true
}
