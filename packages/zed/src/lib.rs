use std::{env, fs, path::PathBuf};
use zed::settings::LspSettings;
use zed_extension_api::{self as zed, LanguageServerId, Result};

const GITHUB_REPO: &str = "wc-toolkit/wc-language-server";
const JS_ASSET_NAME: &str = "wc-language-server.js";
const SERVER_VERSION_MARKER: &str = "server/bin/.release-version";
const CUSTOM_SERVER_ENV: &str = "WC_LANGUAGE_SERVER_BINARY";

struct WebComponentsExtension;

impl WebComponentsExtension {
    fn resolve_server_script(&self) -> Result<(PathBuf, bool)> {
        println!("[wc-tools] Resolving server script...");
        if let Ok(custom) = env::var(CUSTOM_SERVER_ENV) {
            let custom_path = PathBuf::from(custom);
            return Ok((custom_path.clone(), Self::is_node_script(&custom_path)));
        }

        let extension_root = env::current_dir()
            .map_err(|err| format!("failed to resolve extension root: {err}"))?;
        let extension_root = match fs::canonicalize(&extension_root) {
            Ok(path) => path,
            Err(err) => {
                println!(
                    "[wc-tools] Failed to canonicalize extension root {:?}: {err}. Using raw path.",
                    extension_root
                );
                extension_root
            }
        };
        let (preferred_asset, preferred_requires_node) = Self::server_asset_for_platform();
        let script = extension_root
            .join("server/bin")
            .join(preferred_asset);
        let version_marker = extension_root.join(SERVER_VERSION_MARKER);

        self.ensure_latest_language_server(
            &script,
            &version_marker,
            preferred_asset,
            preferred_requires_node,
        )
    }

    fn ensure_latest_language_server(
        &self,
        script: &PathBuf,
        version_marker: &PathBuf,
        preferred_asset: &str,
        preferred_requires_node: bool,
    ) -> Result<(PathBuf, bool)> {
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
                return Ok((script.clone(), preferred_requires_node));
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

        let preferred_release_asset = release
            .assets
            .iter()
            .find(|asset| asset.name == preferred_asset)
            .cloned();
        let js_release_asset = release
            .assets
            .iter()
            .find(|asset| asset.name == JS_ASSET_NAME)
            .cloned();
        let js_path = script
            .parent()
            .unwrap_or_else(|| script.as_path())
            .join(JS_ASSET_NAME);

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
            return Ok((script.clone(), preferred_requires_node));
        }

        if js_path.exists()
            && current_version
                .as_deref()
                .map(|version| version == release.version)
                .unwrap_or(false)
        {
            println!(
                "[wc-tools] Using cached language server {} at {}",
                release.version,
                js_path.display()
            );
            return Ok((js_path, true));
        }

        let (asset, target_path, requires_node) = match preferred_release_asset {
            Some(asset) => (asset, script.clone(), preferred_requires_node),
            None if script.exists() => {
                println!(
                    "[wc-tools] Latest release {} is missing asset {}. Using existing server at {}",
                    release.version,
                    preferred_asset,
                    script.display()
                );
                return Ok((script.clone(), preferred_requires_node));
            }
            None => match js_release_asset {
                Some(asset) => (asset, js_path.clone(), true),
                None if js_path.exists() => {
                    println!(
                        "[wc-tools] Latest release {} is missing asset {}. Using existing server at {}",
                        release.version,
                        JS_ASSET_NAME,
                        js_path.display()
                    );
                    return Ok((js_path, true));
                }
                None => {
                    return Err(format!(
                        "latest release {} is missing required assets {} or {} and no cached server exists at {}",
                        release.version,
                        preferred_asset,
                        JS_ASSET_NAME,
                        script.display()
                    )
                    .into());
                }
            }
        };

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                format!("failed to create language server directory {parent:?}: {err}")
            })?;
        }

        let script_path = target_path.to_string_lossy().to_string();
        println!(
            "[wc-tools] Downloading language server {} -> {}",
            release.version, script_path
        );

        zed::download_file(
            &asset.download_url,
            &script_path,
            zed::DownloadedFileType::Uncompressed,
        )?;

        // The server is executed by Node when using the JS bundle; binaries still benefit from the executable bit.
        let _ = zed::make_file_executable(&script_path);

        fs::write(version_marker, release.version).map_err(|err| {
            format!(
                "failed to record downloaded language server version at {}: {err}",
                version_marker.display()
            )
        })?;

        Ok((target_path, requires_node))
    }

    fn server_asset_for_platform() -> (&'static str, bool) {
        match env::consts::OS {
            "windows" => ("wc-language-server-windows-x64.exe", false),
            "macos" => {
                if env::consts::ARCH == "aarch64" {
                    ("wc-language-server-macos-arm64", false)
                } else {
                    ("wc-language-server-macos-x64", false)
                }
            }
            "linux" => {
                if env::consts::ARCH == "aarch64" {
                    ("wc-language-server-linux-arm64", false)
                } else {
                    ("wc-language-server-linux-x64", false)
                }
            }
            _ => (JS_ASSET_NAME, true),
        }
    }

    fn is_node_script(path: &PathBuf) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| matches!(ext, "js" | "cjs" | "mjs"))
            .unwrap_or(false)
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
        let (server_path, requires_node) = self.resolve_server_script()?;
        let server_path_string = server_path.to_string_lossy().to_string();
        let (command, args) = if requires_node {
            (
                zed::node_binary_path()?,
                vec![server_path_string, "--stdio".to_string()],
            )
        } else {
            (server_path_string, vec!["--stdio".to_string()])
        };
        Ok(zed::Command {
            command,
            args,
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