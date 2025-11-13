package com.wctoolkit.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.wctoolkit.services.WCLanguageServerService

/**
 * Action to restart the Web Components Language Server
 */
class RestartLanguageServerAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project: Project = e.project ?: return
        
        val service = WCLanguageServerService.getInstance(project)
        service.restartLanguageServer()
        
        Messages.showInfoMessage(
            project,
            "Web Components Language Server restart requested.",
            "Language Server"
        )
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
