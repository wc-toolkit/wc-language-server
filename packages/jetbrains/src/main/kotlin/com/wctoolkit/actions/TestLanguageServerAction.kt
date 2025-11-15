package com.wctoolkit.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.wctoolkit.services.WCLanguageServerService
import org.eclipse.lsp4j.WorkspaceSymbolParams

/**
 * Action to test if the language server connection is working
 */
class TestLanguageServerAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project: Project = e.project ?: return
        
        val languageServerService = WCLanguageServerService.getInstance(project)
        val languageServer = languageServerService.getLanguageServer()
        
        if (languageServer == null) {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Web Components")
                .createNotification(
                    "Language Server Not Running",
                    "The language server is not running.",
                    NotificationType.ERROR
                )
                .notify(project)
            return
        }
        
        Thread {
            try {
                // Test 1: Standard LSP workspace/symbol request
                val symbolsResult = languageServer.workspaceService.symbol(WorkspaceSymbolParams("test")).get()
                val symbolCount = when (symbolsResult) {
                    is List<*> -> symbolsResult.size
                    else -> 0
                }
                
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("Web Components")
                    .createNotification(
                        "Language Server Connection Test",
                        "✓ Standard LSP request works!\nFound $symbolCount symbols\n\nNow testing custom request...",
                        NotificationType.INFORMATION
                    )
                    .notify(project)
                
                // Test 2: Custom request
                val customResult = languageServerService.sendCustomRequest(
                    "wctools/getDocs", 
                    null, 
                    Any::class.java
                )?.get()
                
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("Web Components")
                    .createNotification(
                        "Custom Request Test Result",
                        "Result: $customResult\nType: ${customResult?.javaClass?.name}",
                        if (customResult != null) NotificationType.INFORMATION else NotificationType.WARNING
                    )
                    .notify(project)
                    
            } catch (ex: Exception) {
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("Web Components")
                    .createNotification(
                        "Test Failed",
                        ex.message ?: "Unknown error",
                        NotificationType.ERROR
                    )
                    .notify(project)
            }
        }.start()
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
