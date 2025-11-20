package com.wctoolkit.webcomponents.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * Application-level settings for the Web Components Language Server plugin
 */
@State(
    name = "com.wctoolkit.webcomponents.settings.WCSettings",
    storages = [Storage("WebComponentsLanguageServer.xml")]
)
class WCSettings : PersistentStateComponent<WCSettings> {
    
    // Node.js path
    var nodePath: String = ""
    
    // MCP Server settings
    var mcpEnabled: Boolean = false
    var mcpTransport: String = "http" // "http" or "stdio"
    var mcpPort: Int = 3000
    var mcpHost: String = "localhost"
    
    override fun getState(): WCSettings {
        return this
    }
    
    override fun loadState(state: WCSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }
    
    companion object {
        fun getInstance(): WCSettings {
            return ApplicationManager.getApplication().getService(WCSettings::class.java)
        }
    }
}
