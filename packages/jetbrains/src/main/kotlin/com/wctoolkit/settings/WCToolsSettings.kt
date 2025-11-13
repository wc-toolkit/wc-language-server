package com.wctoolkit.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.project.Project
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * Settings for Web Components Toolkit
 */
@State(
    name = "WCToolsSettings",
    storages = [Storage("wc-tools.xml")]
)
@Service(Service.Level.PROJECT)
class WCToolsSettings : PersistentStateComponent<WCToolsSettings.State> {
    
    data class State(
        var mcpEnabled: Boolean = false,
        var mcpTransport: String = "http",
        var mcpPort: Int = 3000,
        var mcpHost: String = "localhost",
        var autoRestartOnConfigChange: Boolean = true,
        var showDiagnostics: Boolean = true
    )
    
    private var myState = State()
    
    override fun getState(): State = myState
    
    override fun loadState(state: State) {
        XmlSerializerUtil.copyBean(state, myState)
    }
    
    companion object {
        fun getInstance(project: Project): WCToolsSettings {
            return project.getService(WCToolsSettings::class.java)
        }
    }
}
