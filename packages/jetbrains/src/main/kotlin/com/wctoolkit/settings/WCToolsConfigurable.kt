package com.wctoolkit.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.Project
import javax.swing.*

/**
 * Configurable UI for Web Components Toolkit settings
 */
class WCToolsConfigurable(private val project: Project) : Configurable {
    
    private var settingsComponent: WCToolsSettingsComponent? = null
    
    override fun getDisplayName(): String = "Web Components"
    
    override fun createComponent(): JComponent {
        settingsComponent = WCToolsSettingsComponent()
        return settingsComponent!!.getPanel()
    }
    
    override fun isModified(): Boolean {
        val settings = WCToolsSettings.getInstance(project).state
        val component = settingsComponent ?: return false
        
        return settings.mcpEnabled != component.getMcpEnabled() ||
               settings.mcpTransport != component.getMcpTransport() ||
               settings.mcpPort != component.getMcpPort() ||
               settings.mcpHost != component.getMcpHost() ||
               settings.autoRestartOnConfigChange != component.getAutoRestart() ||
               settings.showDiagnostics != component.getShowDiagnostics()
    }
    
    override fun apply() {
        val settings = WCToolsSettings.getInstance(project).state
        val component = settingsComponent ?: return
        
        settings.mcpEnabled = component.getMcpEnabled()
        settings.mcpTransport = component.getMcpTransport()
        settings.mcpPort = component.getMcpPort()
        settings.mcpHost = component.getMcpHost()
        settings.autoRestartOnConfigChange = component.getAutoRestart()
        settings.showDiagnostics = component.getShowDiagnostics()
    }
    
    override fun reset() {
        val settings = WCToolsSettings.getInstance(project).state
        val component = settingsComponent ?: return
        
        component.setMcpEnabled(settings.mcpEnabled)
        component.setMcpTransport(settings.mcpTransport)
        component.setMcpPort(settings.mcpPort)
        component.setMcpHost(settings.mcpHost)
        component.setAutoRestart(settings.autoRestartOnConfigChange)
        component.setShowDiagnostics(settings.showDiagnostics)
    }
    
    override fun disposeUIResources() {
        settingsComponent = null
    }
}
