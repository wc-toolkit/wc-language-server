package com.wctoolkit.services

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.Launcher
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.launch.LSPLauncher
import org.eclipse.lsp4j.services.LanguageClient
import org.eclipse.lsp4j.services.LanguageServer
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Future

/**
 * Service that manages the Web Components Language Server connection
 */
@Service(Service.Level.PROJECT)
class WCLanguageServerService(private val project: Project) {
    
    private val logger = Logger.getInstance(WCLanguageServerService::class.java)
    
    private var process: Process? = null
    private var languageServer: LanguageServer? = null
    private var launcher: Launcher<LanguageServer>? = null
    private var connection: Future<Void>? = null
    private var isInitialized: Boolean = false
    private val onInitializedCallbacks: MutableList<() -> Unit> = mutableListOf()
    
    // Store the remote proxy for custom requests
    private var remoteProxy: Any? = null
    
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
            
            // For monorepo setups with pnpm, we need to run from workspace root
            // where node_modules/.pnpm has all the dependencies
            val serverFile = File(serverPath)
            val workingDir = if (serverPath.contains("/packages/language-server/")) {
                // Go up from packages/language-server to workspace root
                serverFile.parentFile.parentFile.parentFile
            } else {
                // For non-monorepo installs, use project root
                File(project.basePath ?: ".")
            }
            
            logger.info("Setting working directory to: ${workingDir.absolutePath}")
            processBuilder.directory(workingDir)
            
            // Don't redirect error stream - we want to capture it separately
            // processBuilder.redirectErrorStream(true)
            
            process = processBuilder.start()
            
            // Capture language server stderr for debugging
            Thread {
                process?.errorStream?.bufferedReader()?.use { reader ->
                    reader.lineSequence().forEach { line ->
                        logger.info("[LS stderr] $line")
                    }
                }
            }.start()
            
            // Create LSP connection
            val inputStream: InputStream = process!!.inputStream
            val outputStream: OutputStream = process!!.outputStream
            
            val client = WCLanguageClient(project)
            val newLauncher: Launcher<LanguageServer> = LSPLauncher.createClientLauncher(
                client,
                inputStream,
                outputStream
            )
            
            launcher = newLauncher
            languageServer = newLauncher.remoteProxy
            remoteProxy = newLauncher.remoteProxy
            connection = newLauncher.startListening()
            
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
            launcher = null
            remoteProxy = null
            connection = null
            process = null
            isInitialized = false
            onInitializedCallbacks.clear()
            
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
     * Check if the language server is initialized and ready
     */
    fun isInitialized(): Boolean = isInitialized
    
    /**
     * Register a callback to be invoked when the language server is initialized
     */
    fun onInitialized(callback: () -> Unit) {
        if (isInitialized) {
            callback()
        } else {
            onInitializedCallbacks.add(callback)
        }
    }
    
    /**
     * Send a custom request to the language server
     */
    fun <T> sendCustomRequest(method: String, params: Any?, resultType: Class<T>): CompletableFuture<T>? {
        return try {
            if (remoteProxy == null) {
                logger.warn("Cannot send custom request: remote proxy is null")
                return null
            }
            
            logger.info("Sending custom request: $method")
            logger.info("Remote proxy class: ${remoteProxy?.javaClass?.name}")
            
            // Try to find the request method through reflection
            // LSP4J proxies implement the request() method from the Endpoint interface
            val requestMethod = try {
                remoteProxy?.javaClass?.getMethod("request", String::class.java, Any::class.java)
            } catch (e: NoSuchMethodException) {
                logger.warn("No request method found on proxy class")
                null
            }
            
            if (requestMethod != null) {
                logger.info("Found request method, invoking...")
                val result = requestMethod.invoke(remoteProxy, method, params)
                logger.info("Request invoked, result: ${result?.javaClass?.name}")
                
                @Suppress("UNCHECKED_CAST")
                return result as? CompletableFuture<T>
            }
            
            // Fallback: try casting to Endpoint
            val endpoint = remoteProxy as? org.eclipse.lsp4j.jsonrpc.Endpoint
            if (endpoint != null) {
                logger.info("Using Endpoint interface")
                val result = endpoint.request(method, params)
                @Suppress("UNCHECKED_CAST")
                return result as? CompletableFuture<T>
            }
            
            logger.error("Could not find a way to send custom request")
            null
        } catch (e: Exception) {
            logger.error("Failed to send custom request '$method'", e)
            null
        }
    }
    
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
        try {
            val basePath = project.basePath ?: "."
            
            logger.info("Initializing language server with basePath: $basePath")
            
            // Create initialization params
            val initParams = InitializeParams().apply {
                processId = ProcessHandle.current().pid().toInt()
                rootUri = "file://$basePath"
                capabilities = ClientCapabilities().apply {
                    workspace = WorkspaceClientCapabilities()
                    textDocument = TextDocumentClientCapabilities()
                }
            }
            
            logger.info("Sending initialize request with rootUri: ${initParams.rootUri}")
            
            // Send initialize request
            val initResult = languageServer?.initialize(initParams)?.get()
            logger.info("Language server initialized with capabilities: ${initResult?.capabilities}")
            
            // Send initialized notification
            languageServer?.initialized(InitializedParams())
            
            // Mark as initialized and run callbacks
            isInitialized = true
            logger.info("Language server initialization complete")
            
            // Execute all pending callbacks
            val callbacks = onInitializedCallbacks.toList()
            onInitializedCallbacks.clear()
            callbacks.forEach { it() }
            logger.info("Executed ${callbacks.size} initialization callbacks")
        } catch (e: Exception) {
            logger.error("Failed to initialize language server", e)
            isInitialized = false
        }
    }
}
