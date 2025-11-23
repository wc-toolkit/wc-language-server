use std::env;
use zed_extension_api::{self as zed, LanguageServerId, Result, Worktree};

const BINARY_NAME: &str = "wc-language-server";
const BUNDLED_SERVER_PATH: &str = "language-server/bin/wc-language-server.js";

struct WebComponentsExtension {
    cached_binary_path: Option<String>,
}

impl WebComponentsExtension {
    fn bundled_server_path(&mut self) -> Result<String> {
        if let Some(path) = &self.cached_binary_path {
            return Ok(path.clone());
        }

        let command_path = env::current_dir()
            .map_err(|error| error.to_string())?
            .join(BUNDLED_SERVER_PATH);

        if !command_path.exists() {
            return Err(format!(
                "bundled language server not found at '{}'. Run `pnpm run sync-language-server` from packages/zed to copy the build output.",
                command_path.display()
            )
            .into());
        }

        let command_path = command_path.to_string_lossy().to_string();
        self.cached_binary_path = Some(command_path.clone());
        Ok(command_path)
    }
}

impl zed::Extension for WebComponentsExtension {
    fn new() -> Self {
        Self {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<zed::Command> {
        if let Some(path) = worktree.which(BINARY_NAME) {
            return Ok(zed::Command {
                command: path,
                args: vec!["--stdio".to_string()],
                env: Default::default(),
            });
        }

        let command_path = self.bundled_server_path()?;

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![command_path, "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(WebComponentsExtension);
