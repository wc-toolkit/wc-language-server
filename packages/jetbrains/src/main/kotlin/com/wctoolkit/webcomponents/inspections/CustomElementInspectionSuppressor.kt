package com.wctoolkit.webcomponents.inspections

import com.intellij.codeInspection.InspectionSuppressor
import com.intellij.codeInspection.SuppressQuickFix
import com.intellij.psi.PsiElement
import com.intellij.psi.xml.XmlTag

/**
 * Suppresses IntelliJ's built-in "unknown HTML tag" warnings for custom elements
 * (tags containing a hyphen, per the Web Components specification).
 * 
 * This prevents duplicate warnings since the Language Server Protocol (LSP)
 * already provides diagnostics for invalid custom elements.
 */
class CustomElementInspectionSuppressor : InspectionSuppressor {
    
    override fun isSuppressedFor(element: PsiElement, toolId: String): Boolean {
        // Only suppress "Unknown HTML tag" inspection
        if (toolId != "HtmlUnknownTag" && toolId != "XmlUnknownTag") {
            return false
        }
        
        // Check if this is an XML/HTML tag
        val tag = element as? XmlTag ?: element.parent as? XmlTag ?: return false
        val tagName = tag.name
        
        // Suppress warnings for all custom elements (tags with hyphens)
        // The LSP server handles validation for these elements
        return tagName.contains('-')
    }

    override fun getSuppressActions(element: PsiElement?, toolId: String): Array<SuppressQuickFix> {
        return emptyArray()
    }
}
