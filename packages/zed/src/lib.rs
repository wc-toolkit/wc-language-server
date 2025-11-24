use std::{env, path::PathBuf};
use zed_extension_api as zed;
use zed_extension_api::{
    current_platform,
    settings::LspSettings,
    serde_json::{json, Value},
    LanguageServerId, Os, Result,
};

const SERVER_RELATIVE_PATH: &str = "server/bin/wc-language-server.js";
const CUSTOM_SERVER_ENV: &str = "WC_LANGUAGE_SERVER_BINARY";
const CUSTOM_NODE_ENV: &str = "WC_LANGUAGE_SERVER_NODE";
const CUSTOM_TSDK_ENV: &str = "WC_LANGUAGE_SERVER_TSDK";
const DEFAULT_TYPESCRIPT_RELATIVE_PATH: &str = "node_modules/typescript/lib";
const LSP_SETTINGS_KEY: &str = "wc-language-server";

struct WebComponentsExtension {
    tsdk_path: Option<String>,
}

impl WebComponentsExtension {
    fn resolve_server_script() -> Result<PathBuf> {
        println!("[wc-tools] Resolving server script");
        if let Ok(custom_path) = env::var(CUSTOM_SERVER_ENV) {
            return Ok(PathBuf::from(custom_path));
        }

        let extension_root = env::current_dir()
            .map_err(|err| format!("failed to resolve extension root: {err}"))?;
        Ok(extension_root.join(SERVER_RELATIVE_PATH))
    }

    fn resolve_node_binary() -> Result<String> {
        println!("[wc-tools] Resolving node binary");
        if let Ok(custom_node) = env::var(CUSTOM_NODE_ENV) {
            return Ok(custom_node);
        }
        zed::node_binary_path()
    }

    fn resolve_tsdk(&mut self, worktree: &zed::Worktree) -> String {
        println!("[wc-tools] Resolving tsdk");
        if let Some(path) = &self.tsdk_path {
            return path.clone();
        }

        let resolved = Self::env_override_tsdk()
            .or_else(|| self.workspace_tsdk(worktree))
            .or_else(Self::extension_tsdk);

        let resolved = match resolved {
            Some(path) => path,
            None => {
                let fallback = Self::normalize_path(PathBuf::from(DEFAULT_TYPESCRIPT_RELATIVE_PATH));
                eprintln!(
                    "[wc-language-server] falling back to {fallback} - install TypeScript in your workspace or set {CUSTOM_TSDK_ENV}"
                );
                fallback
            }
        };

        self.tsdk_path = Some(resolved.clone());
        resolved
    }

    fn env_override_tsdk() -> Option<String> {
        println!("[wc-tools] Checking environment override for tsdk");
        env::var(CUSTOM_TSDK_ENV)
            .ok()
            .map(|value| Self::normalize_path(PathBuf::from(value)))
    }

    fn workspace_tsdk(&self, worktree: &zed::Worktree) -> Option<String> {
        println!("[wc-tools] Checking workspace tsdk");
        let root = PathBuf::from(worktree.root_path());
        Self::validate_tsdk_path(root.join(DEFAULT_TYPESCRIPT_RELATIVE_PATH))
    }

    fn extension_tsdk() -> Option<String> {
        println!("[wc-tools] Checking extension tsdk");
        env::current_dir()
            .ok()
            .and_then(|root| Self::validate_tsdk_path(root.join(DEFAULT_TYPESCRIPT_RELATIVE_PATH)))
    }

    fn validate_tsdk_path(path: PathBuf) -> Option<String> {
        println!("[wc-tools] Validating tsdk path: {:?}", path);
        let tsserver = path.join("tsserverlibrary.js");
        if tsserver.exists() {
            Some(Self::normalize_path(path))
        } else {
            None
        }
    }

    fn normalize_path(path: PathBuf) -> String {
        println!("[wc-tools] Normalizing path: {:?}", path);
        let (os, _) = current_platform();
        let sanitized = match os {
            Os::Windows => {
                let trimmed = path.to_string_lossy().trim_start_matches('/').to_string();
                PathBuf::from(trimmed)
            }
            _ => path,
        };
        sanitized.to_string_lossy().into_owned()
    }
}

impl zed::Extension for WebComponentsExtension {
    fn new() -> Self {
        Self { tsdk_path: None }
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        println!("[wc-tools] Creating language server command");
        let server_script = Self::resolve_server_script()?;
        if !server_script.exists() {
            return Err(format!(
                "missing bundled language server at {}. Run `pnpm dev` (or `pnpm --filter @wc-toolkit/zed run bundle`) to generate it.",
                server_script.display()
            )
            .into());
        }

        let node_binary = Self::resolve_node_binary()?;
        let server_path = server_script.to_string_lossy().into_owned();

        eprintln!(
            "[wc-language-server] launching language server via {:?} {}",
            node_binary,
            server_path
        );

        Ok(zed::Command {
            command: node_binary,
            args: vec![server_path, "--stdio".into()],
            env: Default::default(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<Value>> {
        println!("[wc-tools] Creating language server initialization options");
        if let Ok(mut settings) = LspSettings::for_worktree(LSP_SETTINGS_KEY, worktree) {
            if let Some(init) = settings.initialization_options.take() {
                if let Some(tsdk) = init
                    .get("typescript")
                    .and_then(|ts| ts.get("tsdk"))
                    .and_then(|value| value.as_str())
                {
                    self.tsdk_path = Some(tsdk.to_string());
                }
                return Ok(Some(init));
            }
        }

        let tsdk = self.resolve_tsdk(worktree);
        Ok(Some(json!({
            "typescript": {
                "tsdk": tsdk
            }
        })))
    }
}

zed::register_extension!(WebComponentsExtension);
