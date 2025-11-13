package com.wctoolkit.services

import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.LanguageClient
import org.eclipse.lsp4j.services.LanguageServer
import java.util.concurrent.CompletableFuture

/**
 * Language client implementation for Web Components Language Server
 */
class WCLanguageClient(private val project: Project) : LanguageClient {
    
    private val logger = Logger.getInstance(WCLanguageClient::class.java)
    
    override fun telemetryEvent(obj: Any?) {
        logger.debug("Telemetry event: $obj")
    }
    
    override fun publishDiagnostics(diagnostics: PublishDiagnosticsParams?) {
        diagnostics?.let {
            logger.info("Received diagnostics for ${it.uri}: ${it.diagnostics.size} issues")
            // TODO: Convert LSP diagnostics to IntelliJ annotations
        }
    }
    
    override fun showMessage(messageParams: MessageParams?) {
        messageParams?.let {
            when (it.type) {
                MessageType.Error -> logger.error(it.message)
                MessageType.Warning -> logger.warn(it.message)
                MessageType.Info -> logger.info(it.message)
                MessageType.Log -> logger.debug(it.message)
                else -> logger.debug(it.message)
            }
        }
    }
    
    override fun showMessageRequest(requestParams: ShowMessageRequestParams?): CompletableFuture<MessageActionItem> {
        // TODO: Show message dialog and return user selection
        return CompletableFuture.completedFuture(MessageActionItem("OK"))
    }
    
    override fun logMessage(message: MessageParams?) {
        message?.let {
            logger.info("[LS] ${it.message}")
        }
    }
}
