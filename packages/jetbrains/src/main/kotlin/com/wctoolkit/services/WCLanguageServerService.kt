package com.wctoolkit.services

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger
import org.eclipse.lsp4j.jsonrpc.Launcher
import org.eclipse.lsp4j.launch.LSPLauncher
import org.eclipse.lsp4j.services.LanguageClient
import org.eclipse.lsp4j.services.LanguageServer
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.Future

/**
 * Service that manages the Web Components Language Server connection
 */
@Service(Service.Level.PROJECT)
class WCLanguageServerService(private val project: Project) {
    
    private val logger = Logger.getInstance(WCLanguageServerService::class.java)
    
    private var process: Process? = null
    private var languageServer: LanguageServer? = null
    private var connection: Future<Void>? = null
    
    companion object {
        fun getInstance(project: Project): WCLanguageServerService {
            return project.getService(WCLanguageServerService::class.java)
        }
    }
    
    /**
     * Start the language server process
     */
    fun startLanguageServer() {
        if (process != null) {
            logger.warn("Language server already running")
            return
        }
        
        try {
            // Find the language server binary
            val serverPath = findLanguageServerPath()
            
            if (serverPath == null) {
                logger.error("Could not find wc-language-server binary")
                
                // Show user-friendly notification
                NotificationGroupManager.getInstance()
                    .getNotificationGroup("Web Components")
                    .createNotification(
                        "Web Components Language Server Not Found",
                        "Install: npm install -g @wc-toolkit/language-server\n" +
                        "Or ensure your project has the language server in packages/language-server/",
                        NotificationType.WARNING
                    )
                    .notify(project)
                
                return
            }
            
            logger.info("Starting language server from: $serverPath")
            
            // Start the Node.js process
            val processBuilder = ProcessBuilder(
                "node",
                serverPath,
                "--stdio"
            )
            
            // Set working directory to project root
            processBuilder.directory(File(project.basePath ?: "."))
            processBuilder.redirectErrorStream(true)
            
            process = processBuilder.start()
            
            // Create LSP connection
            val inputStream: InputStream = process!!.inputStream
            val outputStream: OutputStream = process!!.outputStream
            
            val client = WCLanguageClient(project)
            val launcher: Launcher<LanguageServer> = LSPLauncher.createClientLauncher(
                client,
                inputStream,
                outputStream
            )
            
            languageServer = launcher.remoteProxy
            connection = launcher.startListening()
            
            // Initialize the language server
            initializeLanguageServer()
            
            logger.info("Language server started successfully")
            
        } catch (e: Exception) {
            logger.error("Failed to start language server", e)
        }
    }
    
    /**
     * Stop the language server process
     */
    fun stopLanguageServer() {
        try {
            languageServer?.shutdown()?.get()
            languageServer?.exit()
            connection?.cancel(true)
            process?.destroy()
            
            languageServer = null
            connection = null
            process = null
            
            logger.info("Language server stopped")
        } catch (e: Exception) {
            logger.error("Error stopping language server", e)
        }
    }
    
    /**
     * Restart the language server
     */
    fun restartLanguageServer() {
        logger.info("Restarting language server")
        stopLanguageServer()
        Thread.sleep(500) // Brief delay before restart
        startLanguageServer()
    }
    
    /**
     * Get the language server instance
     */
    fun getLanguageServer(): LanguageServer? = languageServer
    
    /**
     * Check if the language server is running
     */
    fun isRunning(): Boolean = process?.isAlive == true
    
    /**
     * Find the language server binary path
     */
    private fun findLanguageServerPath(): String? {
        val basePath = project.basePath
        logger.info("Project base path: $basePath")
        
        if (basePath == null) {
            logger.warn("Project base path is null")
            return null
        }
        
        // Try multiple possible locations
        val possiblePaths = listOf(
            // 1. In the workspace packages (monorepo structure from project root)
            "$basePath/packages/language-server/bin/wc-language-server.js",
            
            // 2. Go up from demos folder to find language server
            "$basePath/../packages/language-server/bin/wc-language-server.js",
            "$basePath/../../packages/language-server/bin/wc-language-server.js",
            
            // 3. Bundled with the plugin in node_modules
            "$basePath/node_modules/.bin/wc-language-server",
            "$basePath/node_modules/@wc-toolkit/language-server/bin/wc-language-server.js",
            
            // 4. Global npm installation
            "/usr/local/bin/wc-language-server",
            "/opt/homebrew/bin/wc-language-server",
            
            // 5. User's npm global directory
            "${System.getProperty("user.home")}/.npm-global/bin/wc-language-server",
            "${System.getProperty("user.home")}/.npm/bin/wc-language-server"
        )
        
        for (path in possiblePaths) {
            val file = File(path)
            val canonicalPath = try {
                file.canonicalPath
            } catch (e: Exception) {
                path
            }
            
            logger.info("Checking: $canonicalPath (exists: ${file.exists()}, canRead: ${file.canRead()})")
            
            if (file.exists() && file.canRead()) {
                logger.info("✓ Found language server at: $canonicalPath")
                return file.canonicalPath
            }
        }
        
        logger.error("Language server not found. Searched in ${possiblePaths.size} locations")
        logger.error("Project base path was: $basePath")
        
        return null
    }
    
    /**
     * Initialize the language server with proper configuration
     */
    private fun initializeLanguageServer() {
        // TODO: Send initialize request with workspace configuration
        // This will be implemented when we add full LSP4J integration
    }
}
