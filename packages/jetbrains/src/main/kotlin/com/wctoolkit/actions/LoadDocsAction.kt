package com.wctoolkit.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.wctoolkit.services.ManifestLoaderService
import com.wctoolkit.services.WCLanguageServerService

/**
 * Action to manually trigger loading of component documentation
 */
class LoadDocsAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project: Project = e.project ?: return
        
        val languageServerService = WCLanguageServerService.getInstance(project)
        val manifestLoaderService = ManifestLoaderService.getInstance(project)
        
        if (!languageServerService.isRunning()) {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Web Components")
                .createNotification(
                    "Language Server Not Running",
                    "The language server is not running. Please wait for it to start or restart it.",
                    NotificationType.WARNING
                )
                .notify(project)
            return
        }
        
        if (!languageServerService.isInitialized()) {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Web Components")
                .createNotification(
                    "Language Server Not Initialized",
                    "The language server is still initializing. Please wait a moment and try again.",
                    NotificationType.WARNING
                )
                .notify(project)
            return
        }
        
        // Load docs in background
        Thread {
            manifestLoaderService.loadDocs()
            
            val count = manifestLoaderService.getComponentCount()
            
            NotificationGroupManager.getInstance()
                .getNotificationGroup("Web Components")
                .createNotification(
                    "Component Documentation Loaded",
                    if (count > 0) {
                        "Successfully loaded $count component(s)"
                    } else {
                        "No components found. Make sure you have a custom-elements.json file."
                    },
                    if (count > 0) NotificationType.INFORMATION else NotificationType.WARNING
                )
                .notify(project)
        }.start()
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
