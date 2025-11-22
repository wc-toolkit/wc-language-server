use std::fs;
use std::path::PathBuf;
use zed_extension_api::{self as zed, LanguageServerId, Result};

struct WebComponentsExtension;

impl WebComponentsExtension {
    fn get_language_server_path(&self) -> Result<PathBuf> {
        // In dev mode, check if we're in the monorepo and use the local version
        // This checks relative to the extension directory
        let dev_server_path = PathBuf::from("..")
            .join("language-server")
            .join("bin")
            .join("wc-language-server.js");
        
        if fs::metadata(&dev_server_path).map_or(false, |stat| stat.is_file()) {
            return fs::canonicalize(dev_server_path)
                .map_err(|e| format!("Failed to canonicalize dev server path: {}", e));
        }

        // Production: use bundled language server from extension directory
        // The path is relative to the extension's root where this binary runs
        let language_server_path = PathBuf::from("language-server")
            .join("bin")
            .join("wc-language-server.js");

        if !fs::metadata(&language_server_path).map_or(false, |stat| stat.is_file()) {
            return Err(format!(
                "Language server not found at: {}. Checked paths: dev={}, prod={}",
                language_server_path.display(),
                dev_server_path.display(),
                language_server_path.display()
            ));
        }

        fs::canonicalize(language_server_path)
            .map_err(|e| format!("Failed to canonicalize language server path: {}", e))
    }
}

impl zed::Extension for WebComponentsExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let language_server_path = self.get_language_server_path()?;

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                language_server_path.to_string_lossy().to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        let settings = zed::settings::LspSettings::for_worktree("web-components-language-server", worktree)
            .ok()
            .and_then(|lsp_settings| lsp_settings.settings.clone())
            .unwrap_or_default();

        Ok(Some(settings))
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        let initialization_options =
            zed::settings::LspSettings::for_worktree("web-components-language-server", worktree)
                .ok()
                .and_then(|lsp_settings| lsp_settings.initialization_options.clone())
                .unwrap_or_default();

        Ok(Some(initialization_options))
    }

    fn label_for_completion(
        &self,
        _language_server_id: &LanguageServerId,
        completion: zed::lsp::Completion,
    ) -> Option<zed::CodeLabel> {
        // Enhanced completion labels for web components
        let label = &completion.label;
        
        // Check if it's a web component (contains hyphen)
        if label.contains('-') && !label.starts_with('<') {
            // Style web component tags distinctly
            return Some(zed::CodeLabel {
                code: format!("<{}>", label),
                spans: vec![],
                filter_range: (0..label.len()).into(),
            });
        }

        // Check for attribute completions
        if let Some(detail) = &completion.detail {
            if detail.contains("attribute") || detail.contains("prop") {
                return Some(zed::CodeLabel {
                    code: label.clone(),
                    spans: vec![],
                    filter_range: (0..label.len()).into(),
                });
            }
        }

        None
    }

    fn label_for_symbol(
        &self,
        _language_server_id: &LanguageServerId,
        symbol: zed::lsp::Symbol,
    ) -> Option<zed::CodeLabel> {
        // Enhanced symbol labels for custom elements
        let name = &symbol.name;
        
        if name.contains('-') {
            return Some(zed::CodeLabel {
                code: format!("<{}>", name),
                spans: vec![],
                filter_range: (0..name.len()).into(),
            });
        }

        None
    }
}

zed::register_extension!(WebComponentsExtension);
