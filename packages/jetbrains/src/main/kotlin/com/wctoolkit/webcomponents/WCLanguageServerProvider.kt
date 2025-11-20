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
        // Start the server if the file type is relevant
        if (isRelevantFile(file)) {
            println("File is relevant, starting server for: ${file.name}")
            serverStarter.ensureServerStarted(WCLanguageServerDescriptor(project))
        } else {
            println("File is NOT relevant: ${file.name}, extension: ${file.extension}")
        }
    }

    private fun isRelevantFile(file: VirtualFile): Boolean {
        val extension = file.extension?.lowercase() ?: return false
        return extension in listOf(
            "html", "htm", "xhtml",
            "vue", "svelte",
            "jsx", "tsx",
            "astro", "mdx",
            "cshtml", "twig"
        )
    }
}

/**
 * Descriptor for the Web Components Language Server
 */
class WCLanguageServerDescriptor(project: Project) : ProjectWideLspServerDescriptor(project, "Web Components") {
    
    override fun isSupportedFile(file: VirtualFile): Boolean {
        val extension = file.extension?.lowercase() ?: return false
        val isSupported = extension in listOf(
            "html", "htm", "xhtml",
            "vue", "svelte",
            "jsx", "tsx",
            "astro", "mdx",
            "cshtml", "twig"
        )
        return isSupported
    }

    override fun createCommandLine(): GeneralCommandLine {
        val settings = WCSettings.getInstance()
        
        // Find Node.js executable
        val nodePath = findNodeExecutable()
            ?: throw IllegalStateException("Node.js not found. Please install Node.js or configure the path in settings.")
        
        // Get the language server script path from plugin resources
        val pluginId = PluginId.getId("com.wc-toolkit.web-components-language-server")
        val plugin = PluginManagerCore.getPlugin(pluginId)
            ?: throw IllegalStateException("Plugin not found: com.wc-toolkit.web-components-language-server")
        
        val pluginPath = plugin.pluginPath
        val serverScript = pluginPath.resolve("language-server/bin/wc-language-server.js").toFile()
        
        if (!serverScript.exists()) {
            throw IllegalStateException(
                "Language server not found at: ${serverScript.absolutePath}\n" +
                "Please ensure the plugin is properly installed.\n" +
                "Plugin path: $pluginPath"
            )
        }
        
        // Build the command line
        val commandLine = GeneralCommandLine()
            .withExePath(nodePath)
            .withParameters(
                serverScript.absolutePath,
                "--stdio"
            )
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
