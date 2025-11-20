package com.wctoolkit.webcomponents

import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.wctoolkit.webcomponents.mcp.MCPServerService

/**
 * Project-level service for managing the Web Components Language Server lifecycle
 */
@Service(Service.Level.PROJECT)
class WCLanguageServerService(private val project: Project) {
    
    private val logger = Logger.getInstance(WCLanguageServerService::class.java)
    
    init {
        logger.info("Web Components Language Server Service initialized for project: ${project.name}")
    }
    
    /**
     * Restart the language server
     */
    fun restartLanguageServer() {
        logger.info("Restarting Web Components Language Server")
        
        // The actual restart is handled by the LSP framework
        // We just need to trigger a reload of relevant services
        
        // Notify file watcher service
        val fileWatcherService = project.getService(WCFileWatcherService::class.java)
        fileWatcherService?.onServerRestart()
        
        // Reload MCP server
        val mcpService = project.getService(MCPServerService::class.java)
        mcpService?.restart()
    }
    
    companion object {
        fun getInstance(project: Project): WCLanguageServerService {
            return project.getService(WCLanguageServerService::class.java)
        }
    }
}
