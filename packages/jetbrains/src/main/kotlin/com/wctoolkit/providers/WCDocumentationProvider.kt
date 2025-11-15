package com.wctoolkit.providers

import com.intellij.lang.documentation.DocumentationProvider
import com.intellij.openapi.diagnostic.Logger
import com.intellij.psi.PsiElement
import com.intellij.psi.xml.XmlTag
import com.wctoolkit.services.ManifestLoaderService

/**
 * Provides hover documentation for web components
 */
class WCDocumentationProvider : DocumentationProvider {
    
    private val logger = Logger.getInstance(WCDocumentationProvider::class.java)
    
    override fun generateDoc(element: PsiElement?, originalElement: PsiElement?): String? {
        if (element == null) return null
        
        val project = element.project
        val manifestService = ManifestLoaderService.getInstance(project)
        
        // Check if this is a custom element tag
        val tagName = when (element) {
            is XmlTag -> element.name
            else -> return null
        }
        
        logger.info("Generating documentation for tag: $tagName")
        
        // Check if we have docs for this component
        val doc = manifestService.getComponentDoc(tagName)
        if (doc != null) {
            logger.info("Found documentation for $tagName")
            // Convert markdown to HTML for display
            return convertMarkdownToHtml(doc)
        }
        
        logger.info("No documentation found for $tagName")
        return null
    }
    
    override fun getQuickNavigateInfo(element: PsiElement?, originalElement: PsiElement?): String? {
        return generateDoc(element, originalElement)
    }
    
    /**
     * Simple markdown to HTML conversion for documentation display
     */
    private fun convertMarkdownToHtml(markdown: String): String {
        var html = markdown
            // Headers
            .replace(Regex("^### (.+)$", RegexOption.MULTILINE), "<h3>$1</h3>")
            .replace(Regex("^## (.+)$", RegexOption.MULTILINE), "<h2>$1</h2>")
            .replace(Regex("^# (.+)$", RegexOption.MULTILINE), "<h1>$1</h1>")
            // Bold
            .replace(Regex("\\*\\*(.+?)\\*\\*"), "<b>$1</b>")
            // Code blocks
            .replace("`", "<code>").replace("</code></code>", "</code>")
            // Horizontal rules
            .replace("---", "<hr/>")
            // Lists
            .replace(Regex("^- (.+)$", RegexOption.MULTILINE), "<li>$1</li>")
            // Line breaks
            .replace("\n", "<br/>")
        
        return "<html><body>$html</body></html>"
    }
}
