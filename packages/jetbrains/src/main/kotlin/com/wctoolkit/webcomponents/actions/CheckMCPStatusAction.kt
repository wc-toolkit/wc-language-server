package com.wctoolkit.webcomponents.actions

import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages
import com.wctoolkit.webcomponents.mcp.MCPServerService
import com.wctoolkit.webcomponents.settings.WCSettings

/**
 * Action to check the MCP server status
 */
class CheckMCPStatusAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val settings = WCSettings.getInstance()
        
        if (!settings.mcpEnabled) {
            Messages.showInfoMessage(
                project,
                "MCP server is not enabled. Enable it in:\nSettings → Tools → Web Components Language Server",
                "MCP Server Not Enabled"
            )
            return
        }
        
        val mcpService = project.getService(MCPServerService::class.java)
        val isRunning = mcpService.isRunning()
        
        if (!isRunning) {
            Messages.showWarningDialog(
                project,
                "MCP server is enabled but not running. Try restarting the project or check the logs.",
                "MCP Server Not Running"
            )
            return
        }
        
        val componentCount = mcpService.getComponentCount()
        val transport = settings.mcpTransport
        val port = settings.mcpPort
        val host = settings.mcpHost
        
        if (transport == "http") {
            val url = "http://$host:$port/health"
            val result = Messages.showOkCancelDialog(
                project,
                "MCP server is running on http://$host:$port with $componentCount component(s) loaded.\n\nWould you like to open the health check endpoint?",
                "MCP Server Running",
                "Open Health Check",
                "Close",
                Messages.getInformationIcon()
            )
            
            if (result == Messages.OK) {
                BrowserUtil.browse(url)
            }
        } else {
            Messages.showInfoMessage(
                project,
                "MCP server is running in stdio mode with $componentCount component(s) loaded",
                "MCP Server Running"
            )
        }
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
