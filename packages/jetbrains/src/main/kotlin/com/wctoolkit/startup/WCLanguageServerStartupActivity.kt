package com.wctoolkit.startup

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.wctoolkit.services.ConfigWatcherService
import com.wctoolkit.services.ManifestLoaderService
import com.wctoolkit.services.WCLanguageServerService

/**
 * Startup activity to initialize the Web Components Language Server
 */
class WCLanguageServerStartupActivity : StartupActivity {
    
    override fun runActivity(project: Project) {
        // Initialize services
        val languageServerService = WCLanguageServerService.getInstance(project)
        val configWatcherService = ConfigWatcherService.getInstance(project)
        val manifestLoaderService = ManifestLoaderService.getInstance(project)
        
        // Register callback BEFORE starting the server
        languageServerService.onInitialized {
            Thread {
                Thread.sleep(500) // Small delay to let the server fully settle
                manifestLoaderService.loadDocs()
            }.start()
        }
        
        // Start the language server in background
        Thread {
            languageServerService.startLanguageServer()
        }.start()
    }
}
