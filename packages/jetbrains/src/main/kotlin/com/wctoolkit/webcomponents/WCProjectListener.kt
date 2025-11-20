package com.wctoolkit.webcomponents

import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManagerListener

/**
 * Listener for project lifecycle events
 */
class WCProjectListener : ProjectManagerListener {
    
    override fun projectOpened(project: Project) {
        // Initialize services when project opens
        project.getService(WCLanguageServerService::class.java)
        project.getService(WCFileWatcherService::class.java)
        
        // Start MCP server if enabled
        val mcpService = project.getService(com.wctoolkit.webcomponents.mcp.MCPServerService::class.java)
        mcpService.start()
    }
    
    override fun projectClosing(project: Project) {
        // Stop MCP server when project closes
        val mcpService = project.getService(com.wctoolkit.webcomponents.mcp.MCPServerService::class.java)
        mcpService.stop()
    }
}
