use std::{env, fs, path::PathBuf};
use zed::settings::LspSettings;
use zed_extension_api::{self as zed, LanguageServerId, Result};

const GITHUB_REPO: &str = "wc-toolkit/wc-language-server";
const SERVER_ASSET_NAME: &str = "wc-language-server.js";
const SERVER_RELATIVE_PATH: &str = "server/bin/wc-language-server.js";
const SERVER_VERSION_MARKER: &str = "server/bin/.release-version";
const CUSTOM_SERVER_ENV: &str = "WC_LANGUAGE_SERVER_BINARY";

struct WebComponentsExtension;

impl WebComponentsExtension {
    fn resolve_server_script(&self) -> Result<PathBuf> {
        println!("[wc-tools] Resolving server script...");
        if let Ok(custom) = env::var(CUSTOM_SERVER_ENV) {
            return Ok(PathBuf::from(custom));
        }

        let extension_root = env::current_dir()
            .map_err(|err| format!("failed to resolve extension root: {err}"))?;
        let script = extension_root.join(SERVER_RELATIVE_PATH);
        let version_marker = extension_root.join(SERVER_VERSION_MARKER);

        self.ensure_latest_language_server(&script, &version_marker)
    }

    fn ensure_latest_language_server(
        &self,
        script: &PathBuf,
        version_marker: &PathBuf,
    ) -> Result<PathBuf> {
        let release = match zed::latest_github_release(
            GITHUB_REPO,
            zed::GithubReleaseOptions {
                require_assets: true,
                pre_release: false,
            },
        ) {
            Ok(release) => release,
            Err(err) if script.exists() => {
                println!(
                    "[wc-tools] Failed to check GitHub releases: {err}. Using existing server at {}",
                    script.display()
                );
                return Ok(script.clone());
            }
            Err(err) => {
                return Err(format!(
                    "unable to resolve language server release ({}); no existing binary found at {}",
                    err,
                    script.display()
                )
                .into());
            }
        };

        let asset = release
            .assets
            .iter()
            .find(|asset| asset.name == SERVER_ASSET_NAME)
            .cloned();

        let current_version = fs::read_to_string(version_marker)
            .ok()
            .map(|contents| contents.trim().to_owned());

        let up_to_date = script.exists()
            && current_version
                .as_deref()
                .map(|version| version == release.version)
                .unwrap_or(false);

        if up_to_date {
            println!(
                "[wc-tools] Using cached language server {} at {}",
                release.version,
                script.display()
            );
            return Ok(script.clone());
        }

        let asset = match asset {
            Some(asset) => asset,
            None if script.exists() => {
                println!(
                    "[wc-tools] Latest release {} is missing asset {}. Using existing server at {}",
                    release.version,
                    SERVER_ASSET_NAME,
                    script.display()
                );
                return Ok(script.clone());
            }
            None => {
                return Err(format!(
                    "latest release {} is missing required asset {} and no cached server exists at {}",
                    release.version,
                    SERVER_ASSET_NAME,
                    script.display()
                )
                .into());
            }
        };

        if let Some(parent) = script.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                format!("failed to create language server directory {parent:?}: {err}")
            })?;
        }

        let script_path = script.to_string_lossy().to_string();
        println!(
            "[wc-tools] Downloading language server {} -> {}",
            release.version, script_path
        );

        zed::download_file(
            &asset.download_url,
            &script_path,
            zed::DownloadedFileType::Uncompressed,
        )?;

        // The server is executed by Node, but setting the executable bit keeps parity with other clients.
        let _ = zed::make_file_executable(&script_path);

        fs::write(version_marker, release.version).map_err(|err| {
            format!(
                "failed to record downloaded language server version at {}: {err}",
                version_marker.display()
            )
        })?;

        Ok(script.clone())
    }
}

impl zed::Extension for WebComponentsExtension {
    fn new() -> Self {
        println!("[wc-tools] Initializing WebComponentsExtension...");
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        println!("[wc-tools] Resolving language server command...");
        let server_path = self.resolve_server_script()?;
        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_path.to_string_lossy().to_string(), "--stdio".to_string()],
            env: Default::default(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        println!("[wc-tools] Resolving language server initialization options...");
        let initialization_options = LspSettings::for_worktree(server_id.as_ref(), worktree)
            .ok()
            .and_then(|lsp_settings| lsp_settings.initialization_options.clone());
        Ok(initialization_options)
    }

    fn language_server_workspace_configuration(
        &mut self,
        server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        println!("[wc-tools] Resolving language server workspace configuration...");
        let settings = LspSettings::for_worktree(server_id.as_ref(), worktree)
            .ok()
            .and_then(|lsp_settings| lsp_settings.settings.clone())
            .unwrap_or_default();
        Ok(Some(settings))
    }
}

zed::register_extension!(WebComponentsExtension);