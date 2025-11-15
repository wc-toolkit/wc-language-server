package com.wctoolkit.services

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.reflect.TypeToken
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger
import org.eclipse.lsp4j.ExecuteCommandParams

/**
 * Service that loads and manages web component manifests (Custom Elements Manifest)
 */
@Service(Service.Level.PROJECT)
class ManifestLoaderService(private val project: Project) {
    
    private val logger = Logger.getInstance(ManifestLoaderService::class.java)
    private val componentDocs: MutableMap<String, String> = mutableMapOf()
    
    companion object {
        fun getInstance(project: Project): ManifestLoaderService {
            return project.getService(ManifestLoaderService::class.java)
        }
    }
    
    /**
     * Load component documentation from the language server
     */
    fun loadDocs() {
        val languageServerService = WCLanguageServerService.getInstance(project)
        val languageServer = languageServerService.getLanguageServer()
        
        if (languageServer == null) {
            logger.warn("Language server not available, cannot load docs")
            return
        }
        
        if (!languageServerService.isInitialized()) {
            logger.warn("Language server not yet initialized, cannot load docs")
            return
        }
        
        try {
            logger.info("Requesting component docs from language server via workspace/executeCommand")
            
            // Use standard LSP workspace/executeCommand instead of custom request
            val params = ExecuteCommandParams("wctools.getDocs", emptyList())
            val future = languageServer.workspaceService.executeCommand(params)
            
            if (future == null) {
                logger.error("Failed to create request future")
                return
            }
            
            logger.info("Waiting for response from language server...")
            val result = try {
                future.get(5, java.util.concurrent.TimeUnit.SECONDS)
            } catch (e: java.util.concurrent.TimeoutException) {
                logger.error("Timeout waiting for response from language server")
                return
            } catch (e: Exception) {
                logger.error("Error getting result from future", e)
                return
            }
            
            logger.info("Received response from language server: ${result != null}")
            logger.info("Response type: ${result?.javaClass?.name}")
            logger.info("Response toString: $result")
            
            if (result != null) {
                try {
                    // Convert the result to JSON using Gson
                    val gson = Gson()
                    val json = gson.toJsonTree(result)
                    logger.info("Converted to JSON: ${json.isJsonObject}")
                    
                    if (json.isJsonObject) {
                        val mapType = object : TypeToken<Map<String, String>>() {}.type
                        val docs: Map<String, String> = gson.fromJson(json, mapType)
                        
                        updateDocs(docs)
                        logger.info("Successfully loaded ${docs.size} component docs")
                        
                        // Log the component names for debugging
                        if (docs.isNotEmpty()) {
                            logger.info("Components: ${docs.keys.joinToString(", ")}")
                        }
                    } else {
                        logger.warn("Response is not a JSON object")
                    }
                } catch (e: Exception) {
                    logger.error("Failed to parse response", e)
                }
            } else {
                logger.warn("Language server returned null")
            }
        } catch (e: Exception) {
            logger.error("Failed to load docs from language server", e)
        }
    }
    
    /**
     * Get documentation for a specific component
     */
    fun getComponentDoc(componentName: String): String? {
        return componentDocs[componentName]
    }
    
    /**
     * Get all component names
     */
    fun getComponentNames(): Set<String> {
        return componentDocs.keys
    }
    
    /**
     * Get all component documentation
     */
    fun getAllDocs(): Map<String, String> {
        return componentDocs.toMap()
    }
    
    /**
     * Update component documentation
     */
    fun updateDocs(docs: Map<String, String>) {
        componentDocs.clear()
        componentDocs.putAll(docs)
        logger.info("Updated component docs: ${componentDocs.size} components")
    }
    
    /**
     * Get count of loaded components
     */
    fun getComponentCount(): Int {
        return componentDocs.size
    }
}
