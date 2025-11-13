package com.wctoolkit.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.diagnostic.Logger

/**
 * Service that watches for configuration file changes and triggers language server restart
 */
@Service(Service.Level.PROJECT)
class ConfigWatcherService(private val project: Project) {
    
    private val logger = Logger.getInstance(ConfigWatcherService::class.java)
    
    private val watchPatterns = listOf(
        "wc.config.js",
        "wc.config.cjs",
        "wc.config.mjs",
        "wc.config.ts",
        "wc.config.json",
        "custom-elements.json",
        "package.json"
    )
    
    init {
        setupFileWatcher()
    }
    
    companion object {
        fun getInstance(project: Project): ConfigWatcherService {
            return project.getService(ConfigWatcherService::class.java)
        }
    }
    
    private fun setupFileWatcher() {
        project.messageBus.connect().subscribe(
            VirtualFileManager.VFS_CHANGES,
            object : BulkFileListener {
                override fun after(events: List<VFileEvent>) {
                    val relevantChanges = events.filter { event ->
                        shouldRestartOnChange(event.file)
                    }
                    
                    if (relevantChanges.isNotEmpty()) {
                        val changedFiles = relevantChanges.mapNotNull { it.file?.name }.joinToString(", ")
                        logger.info("Configuration files changed: $changedFiles - scheduling restart")
                        scheduleRestart()
                    }
                }
            }
        )
        
        logger.info("File watcher set up for config files")
    }
    
    private fun shouldRestartOnChange(file: VirtualFile?): Boolean {
        if (file == null) return false
        
        return watchPatterns.any { pattern ->
            file.name.matches(Regex(pattern.replace(".", "\\.").replace("*", ".*")))
        } || file.path.contains("node_modules")
    }
    
    private fun scheduleRestart() {
        // Debounce restarts - wait a bit in case multiple files change
        Thread {
            Thread.sleep(1000)
            WCLanguageServerService.getInstance(project).restartLanguageServer()
        }.start()
    }
}
