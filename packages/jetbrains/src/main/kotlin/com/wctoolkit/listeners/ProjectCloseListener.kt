package com.wctoolkit.listeners

import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManagerListener
import com.wctoolkit.services.WCLanguageServerService

/**
 * Listener to handle project close events
 */
class ProjectCloseListener : ProjectManagerListener {
    
    override fun projectClosing(project: Project) {
        // Stop the language server when project closes
        WCLanguageServerService.getInstance(project).stopLanguageServer()
    }
}
