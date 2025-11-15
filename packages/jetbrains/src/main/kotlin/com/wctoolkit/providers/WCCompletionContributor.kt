package com.wctoolkit.providers

import com.intellij.codeInsight.completion.*
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.openapi.diagnostic.Logger
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.xml.XmlTokenType
import com.intellij.util.ProcessingContext
import com.wctoolkit.services.ManifestLoaderService
import com.wctoolkit.services.WCLanguageServerService

/**
 * Provides autocomplete suggestions for web components based on Custom Elements Manifest
 */
class WCCompletionContributor : CompletionContributor() {
    
    private val logger = Logger.getInstance(WCCompletionContributor::class.java)
    
    init {
        // Trigger on tag names (after <)
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(XmlTokenType.XML_NAME),
            TagNameCompletionProvider()
        )
        
        // Trigger on attributes (inside tags)
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(XmlTokenType.XML_ATTRIBUTE_VALUE_TOKEN),
            AttributeCompletionProvider()
        )
    }
    
    /**
     * Provides completions for custom element tag names
     */
    private class TagNameCompletionProvider : CompletionProvider<CompletionParameters>() {
        private val logger = Logger.getInstance(TagNameCompletionProvider::class.java)
        
        override fun addCompletions(
            parameters: CompletionParameters,
            context: ProcessingContext,
            result: CompletionResultSet
        ) {
            val project = parameters.position.project
            val manifestService = ManifestLoaderService.getInstance(project)
            val components = manifestService.getComponentNames()
            
            logger.info("Providing ${components.size} component completions")
            logger.info("Component names: ${components.joinToString(", ")}")
            
            for (componentName in components) {
                logger.info("Adding completion for: $componentName")
                
                result.addElement(
                    LookupElementBuilder.create(componentName)
                        .withTypeText("Web Component", true)
                        .withTailText(" (custom element)", true)
                        .withBoldness(true)
                )
            }
        }
    }
    
    /**
     * Provides completions for custom element attributes
     */
    private class AttributeCompletionProvider : CompletionProvider<CompletionParameters>() {
        override fun addCompletions(
            parameters: CompletionParameters,
            context: ProcessingContext,
            result: CompletionResultSet
        ) {
            // TODO: Parse current tag and provide relevant attribute completions
            // This would require parsing the component docs to extract attributes
        }
    }
}
