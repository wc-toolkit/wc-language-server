package com.wctoolkit.webcomponents.settings

import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.TextFieldWithBrowseButton
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * Settings UI for the Web Components Language Server plugin
 */
class WCSettingsConfigurable : Configurable {
    
    private var settingsPanel: JPanel? = null
    private var nodePathField: TextFieldWithBrowseButton? = null
    private var mcpEnabledCheckbox: JBCheckBox? = null
    private var mcpTransportField: JBTextField? = null
    private var mcpPortField: JBTextField? = null
    private var mcpHostField: JBTextField? = null
    
    override fun getDisplayName(): String {
        return "Web Components Language Server"
    }
    
    override fun createComponent(): JComponent {
        val settings = WCSettings.getInstance()
        
        // Node.js path field
        nodePathField = TextFieldWithBrowseButton().apply {
            text = settings.nodePath
            addBrowseFolderListener(
                "Select Node.js Executable",
                "Choose the Node.js executable file",
                null,
                FileChooserDescriptorFactory.createSingleFileDescriptor()
            )
        }
        
        // MCP settings
        mcpEnabledCheckbox = JBCheckBox("Enable MCP Server", settings.mcpEnabled)
        mcpTransportField = JBTextField(settings.mcpTransport)
        mcpPortField = JBTextField(settings.mcpPort.toString())
        mcpHostField = JBTextField(settings.mcpHost)
        
        settingsPanel = FormBuilder.createFormBuilder()
            .addLabeledComponent("Node.js path (leave empty to use PATH):", nodePathField!!)
            .addSeparator()
            .addComponent(mcpEnabledCheckbox!!)
            .addLabeledComponent("MCP Transport (http or stdio):", mcpTransportField!!)
            .addLabeledComponent("MCP Port:", mcpPortField!!)
            .addLabeledComponent("MCP Host:", mcpHostField!!)
            .addComponentFillVertically(JPanel(), 0)
            .panel
        
        return settingsPanel!!
    }
    
    override fun isModified(): Boolean {
        val settings = WCSettings.getInstance()
        return nodePathField?.text != settings.nodePath ||
               mcpEnabledCheckbox?.isSelected != settings.mcpEnabled ||
               mcpTransportField?.text != settings.mcpTransport ||
               mcpPortField?.text?.toIntOrNull() != settings.mcpPort ||
               mcpHostField?.text != settings.mcpHost
    }
    
    override fun apply() {
        val settings = WCSettings.getInstance()
        settings.nodePath = nodePathField?.text ?: ""
        settings.mcpEnabled = mcpEnabledCheckbox?.isSelected ?: false
        settings.mcpTransport = mcpTransportField?.text ?: "http"
        settings.mcpPort = mcpPortField?.text?.toIntOrNull() ?: 3000
        settings.mcpHost = mcpHostField?.text ?: "localhost"
    }
    
    override fun reset() {
        val settings = WCSettings.getInstance()
        nodePathField?.text = settings.nodePath
        mcpEnabledCheckbox?.isSelected = settings.mcpEnabled
        mcpTransportField?.text = settings.mcpTransport
        mcpPortField?.text = settings.mcpPort.toString()
        mcpHostField?.text = settings.mcpHost
    }
}
