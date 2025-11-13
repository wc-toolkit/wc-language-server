package com.wctoolkit.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger

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
        val languageServer = WCLanguageServerService.getInstance(project).getLanguageServer()
        
        if (languageServer == null) {
            logger.warn("Language server not available, cannot load docs")
            return
        }
        
        // TODO: Request docs from language server via custom LSP command
        // This would use: languageServer.workspaceService.executeCommand(...)
        
        logger.info("Requesting component docs from language server")
    }
    
    /**
     * Get documentation for a specific component
     */
    fun getComponentDoc(componentName: String): String? {
        return componentDocs[componentName]
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
