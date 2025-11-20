package com.wctoolkit.webcomponents

import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.util.messages.MessageBusConnection

/**
 * Service that watches for changes to configuration files and triggers language server restart
 */
@Service(Service.Level.PROJECT)
class WCFileWatcherService(private val project: Project) {
    
    private val logger = Logger.getInstance(WCFileWatcherService::class.java)
    private var messageBusConnection: MessageBusConnection? = null
    private var restartScheduled = false
    
    init {
        startWatching()
    }
    
    private fun startWatching() {
        messageBusConnection = project.messageBus.connect()
        messageBusConnection?.subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
            override fun after(events: List<VFileEvent>) {
                for (event in events) {
                    val file = event.file ?: continue
                    val fileName = file.name
                    
                    // Check if this is a file we care about
                    val shouldRestart = when {
                        fileName == "wc.config.js" || 
                        fileName == "wc.config.cjs" || 
                        fileName == "wc.config.mjs" ||
                        fileName == "wc.config.ts" ||
                        fileName == "wc.config.json" -> {
                            logger.info("Config file changed: ${file.path}")
                            true
                        }
                        fileName == "custom-elements.json" -> {
                            logger.info("Custom elements manifest changed: ${file.path}")
                            true
                        }
                        fileName == "package.json" -> {
                            logger.info("package.json changed: ${file.path}")
                            true
                        }
                        file.name == "node_modules" && file.isDirectory -> {
                            logger.info("node_modules changed: ${file.path}")
                            true
                        }
                        else -> false
                    }
                    
                    if (shouldRestart && !restartScheduled) {
                        scheduleRestart("File changed: ${file.name}")
                    }
                }
            }
        })
        
        logger.info("File watcher started for Web Components configuration files")
    }
    
    private fun scheduleRestart(reason: String) {
        if (restartScheduled) return
        
        restartScheduled = true
        logger.info("Scheduling restart: $reason")
        
        // Schedule restart after a short delay to debounce multiple changes
        val timer = java.util.Timer()
        timer.schedule(object : java.util.TimerTask() {
            override fun run() {
                restartScheduled = false
                val service = WCLanguageServerService.getInstance(project)
                service.restartLanguageServer()
                timer.cancel()
            }
        }, 300) // 300ms debounce
    }
    
    fun onServerRestart() {
        logger.info("Language server restarted")
    }
    
    fun dispose() {
        messageBusConnection?.disconnect()
        logger.info("File watcher stopped")
    }
    
    companion object {
        fun getInstance(project: Project): WCFileWatcherService {
            return project.getService(WCFileWatcherService::class.java)
        }
    }
}
