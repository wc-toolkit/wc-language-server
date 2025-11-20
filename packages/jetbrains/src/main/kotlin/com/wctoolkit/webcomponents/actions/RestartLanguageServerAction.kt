package com.wctoolkit.webcomponents.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.wctoolkit.webcomponents.WCLanguageServerService

/**
 * Action to restart the Web Components Language Server
 */
class RestartLanguageServerAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        val service = WCLanguageServerService.getInstance(project)
        service.restartLanguageServer()
        
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Web Components Language Server")
            .createNotification(
                "Web Components Language Server",
                "Language server restart requested.",
                NotificationType.INFORMATION
            )
            .notify(project)
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
