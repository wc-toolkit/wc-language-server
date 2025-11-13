package com.wctoolkit.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.wctoolkit.services.ManifestLoaderService

/**
 * Action to check loaded web component documentation
 */
class CheckDocsAction : AnAction() {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project: Project = e.project ?: return
        
        val service = ManifestLoaderService.getInstance(project)
        val count = service.getComponentCount()
        val allDocs = service.getAllDocs()
        
        val message = if (count > 0) {
            val components = allDocs.keys.joinToString(", ")
            "Loaded $count component(s):\n$components"
        } else {
            "No component documentation loaded yet.\n\nMake sure you have:\n" +
            "1. A custom-elements.json file in your project\n" +
            "2. The language server is running\n" +
            "3. Your project has web components defined"
        }
        
        Messages.showInfoMessage(
            project,
            message,
            "Web Component Documentation"
        )
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
