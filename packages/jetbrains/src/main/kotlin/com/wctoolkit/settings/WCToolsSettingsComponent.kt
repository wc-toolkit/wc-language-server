package com.wctoolkit.settings

import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComboBox
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * UI component for Web Components settings panel
 */
class WCToolsSettingsComponent {
    
    private val panel: JPanel
    private val mcpEnabledCheckbox = JBCheckBox("Enable MCP Server")
    private val mcpTransportCombo = JComboBox(arrayOf("http", "stdio"))
    private val mcpPortField = JBTextField("3000")
    private val mcpHostField = JBTextField("localhost")
    private val autoRestartCheckbox = JBCheckBox("Auto-restart on config changes", true)
    private val showDiagnosticsCheckbox = JBCheckBox("Show diagnostics", true)
    
    init {
        panel = FormBuilder.createFormBuilder()
            .addLabeledComponent("MCP Server:", mcpEnabledCheckbox)
            .addLabeledComponent("MCP Transport:", mcpTransportCombo)
            .addLabeledComponent("MCP Port:", mcpPortField)
            .addLabeledComponent("MCP Host:", mcpHostField)
            .addSeparator()
            .addComponent(autoRestartCheckbox)
            .addComponent(showDiagnosticsCheckbox)
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }
    
    fun getPanel(): JPanel = panel
    
    fun getMcpEnabled(): Boolean = mcpEnabledCheckbox.isSelected
    fun setMcpEnabled(value: Boolean) { mcpEnabledCheckbox.isSelected = value }
    
    fun getMcpTransport(): String = mcpTransportCombo.selectedItem as String
    fun setMcpTransport(value: String) { mcpTransportCombo.selectedItem = value }
    
    fun getMcpPort(): Int = mcpPortField.text.toIntOrNull() ?: 3000
    fun setMcpPort(value: Int) { mcpPortField.text = value.toString() }
    
    fun getMcpHost(): String = mcpHostField.text
    fun setMcpHost(value: String) { mcpHostField.text = value }
    
    fun getAutoRestart(): Boolean = autoRestartCheckbox.isSelected
    fun setAutoRestart(value: Boolean) { autoRestartCheckbox.isSelected = value }
    
    fun getShowDiagnostics(): Boolean = showDiagnosticsCheckbox.isSelected
    fun setShowDiagnostics(value: Boolean) { showDiagnosticsCheckbox.isSelected = value }
}
