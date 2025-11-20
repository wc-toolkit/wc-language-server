package com.wctoolkit.webcomponents.mcp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.OSProcessHandler
import com.intellij.execution.process.ProcessAdapter
import com.intellij.execution.process.ProcessEvent
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.wctoolkit.webcomponents.settings.WCSettings
import java.io.File

/**
 * Service for managing the Model Context Protocol (MCP) server
 */
@Service(Service.Level.PROJECT)
class MCPServerService(private val project: Project) {
    
    private val logger = Logger.getInstance(MCPServerService::class.java)
    private var processHandler: OSProcessHandler? = null
    private var componentCount: Int = 0
    
    fun start() {
        val settings = WCSettings.getInstance()
        
        if (!settings.mcpEnabled) {
            logger.info("MCP server disabled in settings")
            return
        }
        
        // Stop any existing process
        stop()
        
        try {
            val commandLine = createMCPServerCommandLine(settings)
            processHandler = OSProcessHandler(commandLine)
            
            // Add process listener for output
            processHandler?.addProcessListener(object : ProcessAdapter() {
                override fun onTextAvailable(event: ProcessEvent, outputType: Key<*>) {
                    logger.info("MCP Server: ${event.text}")
                    
                    // Parse component count from output if available
                    val text = event.text
                    if (text.contains("component(s) loaded")) {
                        val match = Regex("""(\d+) component\(s\) loaded""").find(text)
                        match?.groupValues?.get(1)?.toIntOrNull()?.let { count ->
                            componentCount = count
                        }
                    }
                }
                
                override fun processTerminated(event: ProcessEvent) {
                    logger.info("MCP Server process terminated with exit code: ${event.exitCode}")
                }
            })
            
            processHandler?.startNotify()
            logger.info("MCP server started (${settings.mcpTransport} mode on ${settings.mcpHost}:${settings.mcpPort})")
            
        } catch (e: Exception) {
            logger.error("Failed to start MCP server", e)
        }
    }
    
    fun stop() {
        processHandler?.let { handler ->
            if (!handler.isProcessTerminated) {
                handler.destroyProcess()
                logger.info("MCP server stopped")
            }
            processHandler = null
        }
    }
    
    fun restart() {
        logger.info("Restarting MCP server")
        stop()
        // Add a small delay before restarting
        Thread.sleep(500)
        start()
    }
    
    fun isRunning(): Boolean {
        return processHandler?.isProcessTerminated == false
    }
    
    fun getComponentCount(): Int {
        return componentCount
    }
    
    private fun createMCPServerCommandLine(settings: WCSettings): GeneralCommandLine {
        // Find Node.js executable
        val nodePath = findNodeExecutable()
            ?: throw IllegalStateException("Node.js not found. Please install Node.js or configure the path in settings.")
        
        // Get the MCP server script path from plugin resources
        val pluginPath = this::class.java.protectionDomain.codeSource.location.path
        val pluginDir = File(pluginPath).parentFile
        val mcpServerScript = File(pluginDir, "vscode/mcp-server.js")
        
        if (!mcpServerScript.exists()) {
            throw IllegalStateException(
                "MCP server script not found at: ${mcpServerScript.absolutePath}\n" +
                "Please ensure the plugin is properly installed."
            )
        }
        
        // Build command line
        val commandLine = GeneralCommandLine()
            .withExePath(nodePath)
            .withParameters(
                mcpServerScript.absolutePath,
                "--transport", settings.mcpTransport,
                "--port", settings.mcpPort.toString(),
                "--host", settings.mcpHost
            )
            .withWorkDirectory(project.basePath)
            .withCharset(Charsets.UTF_8)
        
        commandLine.environment.putAll(System.getenv())
        
        return commandLine
    }
    
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
    
    companion object {
        fun getInstance(project: Project): MCPServerService {
            return project.getService(MCPServerService::class.java)
        }
    }
}
