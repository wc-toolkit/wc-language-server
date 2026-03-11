using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using EnvDTE;
using EnvDTE80;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;

namespace WCToolkit.VisualStudio;

[Export(typeof(ILanguageClient))]
[PartCreationPolicy(CreationPolicy.Shared)]
[ContentType("text")]
public sealed class WebComponentsLanguageClient : ILanguageClient
{
    private static readonly HashSet<string> DefaultSupportedExtensions = ParseExtensions(WebComponentsOptionsPage.DefaultSupportedExtensions);

    private System.Diagnostics.Process? _serverProcess;
    private string _lastLaunchCommand = string.Empty;
    private string _lastLaunchArguments = string.Empty;
    private string _lastResolvedServerPath = string.Empty;
    private DTE2? _dte;
    private DocumentEvents? _documentEvents;
    private bool _waitingForSupportedDocument;
    private HashSet<string> _supportedExtensions = new(DefaultSupportedExtensions, StringComparer.OrdinalIgnoreCase);

    public static WebComponentsLanguageClient? Instance { get; private set; }

    public WebComponentsLanguageClient()
    {
        Instance = this;
    }

    public string Name => "Web Components Language Server";

    public IEnumerable<string> ConfigurationSections => new[] { "wctools" };

    public object? InitializationOptions => null;

    public IEnumerable<string> FilesToWatch => new[]
    {
        "**/wc.config.js",
        "**/wc.config.cjs",
        "**/wc.config.mjs",
        "**/wc.config.ts",
        "**/wc.config.json",
        "**/custom-elements.json",
        "**/package.json"
    };

    public object? CustomMessageTarget => null;

    public object? MiddleLayer => null;

    public bool ShowNotificationOnInitializeFailed => true;

    public event AsyncEventHandler<EventArgs>? StartAsync;

    public event AsyncEventHandler<EventArgs>? StopAsync;

    public async Task OnLoadedAsync()
    {
        if (this.StartAsync is null)
        {
            return;
        }

        var package = WebComponentsPackage.Instance;
        if (package is null)
        {
            await this.StartAsync.InvokeAsync(this, EventArgs.Empty);
            return;
        }

        var activationScope = WebComponentsPackage.Instance?.GetOptions().ActivationScope ?? ActivationScope.AnyText;
        var options = package.GetOptions();
        _supportedExtensions = ParseExtensions(options.SupportedFileExtensions);
        if (_supportedExtensions.Count == 0)
        {
            _supportedExtensions = new HashSet<string>(DefaultSupportedExtensions, StringComparer.OrdinalIgnoreCase);
            Log("Supported File Extensions setting was empty or invalid; using defaults (all extensions).");
        }

        if (activationScope == ActivationScope.AnyText)
        {
            await this.StartAsync.InvokeAsync(this, EventArgs.Empty);
            return;
        }

        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

        _dte = await package.GetServiceAsync(typeof(DTE)) as DTE2;

        if (HasOpenSupportedDocument(_dte, _supportedExtensions))
        {
            await this.StartAsync.InvokeAsync(this, EventArgs.Empty);
            return;
        }

        if (_dte is null)
        {
            await this.StartAsync.InvokeAsync(this, EventArgs.Empty);
            return;
        }

        _documentEvents = _dte.Events.DocumentEvents;
        _documentEvents.DocumentOpened += OnDocumentOpened;
        _waitingForSupportedDocument = true;
        Log("Activation scope is WebComponentFileTypes; waiting for supported file before starting language server.");
    }

    public async Task<Connection?> ActivateAsync(CancellationToken token)
    {
        await TaskScheduler.Default;

        try
        {
            var launch = ResolveLaunchCommand();

            _lastLaunchCommand = launch.Command;
            _lastLaunchArguments = launch.Arguments;
            _lastResolvedServerPath = launch.ResolvedServerPath;

            var startInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = launch.Command,
                Arguments = launch.Arguments,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(launch.ResolvedServerPath) ?? AppContext.BaseDirectory
            };

            _serverProcess = new System.Diagnostics.Process { StartInfo = startInfo, EnableRaisingEvents = true };
            _serverProcess.ErrorDataReceived += (_, args) =>
            {
                if (!string.IsNullOrWhiteSpace(args.Data))
                {
                    Log($"server stderr: {args.Data}");
                }
            };

            if (!_serverProcess.Start())
            {
                Log("failed to start process");
                return null;
            }

            _serverProcess.BeginErrorReadLine();

            Log($"started language server: {launch.Command} {launch.Arguments}".Trim());

            return new Connection(_serverProcess.StandardOutput.BaseStream, _serverProcess.StandardInput.BaseStream);
        }
        catch (Exception ex)
        {
            Log($"failed to activate language server: {ex}");
            return null;
        }
    }

    public Task OnServerInitializedAsync()
    {
        Log("server initialized");
        return Task.CompletedTask;
    }

    public Task<InitializationFailureContext?> OnServerInitializeFailedAsync(ILanguageClientInitializationInfo initializationState)
    {
        Log($"server initialize failed: {initializationState.StatusMessage}");
        return Task.FromResult<InitializationFailureContext?>(null);
    }

    public async Task RequestRestartAsync()
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        UnsubscribeDocumentOpenEvents();

        if (this.StopAsync is not null)
        {
            await this.StopAsync.InvokeAsync(this, EventArgs.Empty);
        }

        if (this.StartAsync is not null)
        {
            await this.StartAsync.InvokeAsync(this, EventArgs.Empty);
        }
    }

    public string GetStatus()
    {
        var processState = _serverProcess is { HasExited: false } ? "running" : "stopped";
        var resolvedPath = string.IsNullOrWhiteSpace(_lastResolvedServerPath) ? "(not resolved yet)" : _lastResolvedServerPath;
        var launch = string.IsNullOrWhiteSpace(_lastLaunchCommand)
            ? "(not launched yet)"
            : $"{_lastLaunchCommand} {_lastLaunchArguments}".Trim();
        var waitingForFile = _waitingForSupportedDocument ? "yes" : "no";

        return $"State: {processState}{Environment.NewLine}" +
               $"Waiting for supported file: {waitingForFile}{Environment.NewLine}" +
               $"Resolved server path: {resolvedPath}{Environment.NewLine}" +
               $"Launch command: {launch}";
    }

    private void OnDocumentOpened(Document document)
    {
        ThreadHelper.JoinableTaskFactory.Run(async () =>
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

            if (this.StartAsync is null)
            {
                return;
            }

            var filePath = document?.FullName;
            if (!IsSupportedFile(filePath, _supportedExtensions))
            {
                return;
            }

            UnsubscribeDocumentOpenEvents();
            await this.StartAsync.InvokeAsync(this, EventArgs.Empty);
        });
    }

    private static bool HasOpenSupportedDocument(DTE2? dte, HashSet<string> supportedExtensions)
    {
        ThreadHelper.ThrowIfNotOnUIThread();

        if (dte is null)
        {
            return false;
        }

        foreach (Document document in dte.Documents)
        {
            if (IsSupportedFile(document.FullName, supportedExtensions))
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsSupportedFile(string? filePath, HashSet<string> supportedExtensions)
    {
        if (string.IsNullOrWhiteSpace(filePath))
        {
            return false;
        }

        if (supportedExtensions.Contains("*"))
        {
            return true;
        }

        var extension = Path.GetExtension(filePath);
        if (string.IsNullOrWhiteSpace(extension))
        {
            return false;
        }

        return supportedExtensions.Contains(extension);
    }

    private static HashSet<string> ParseExtensions(string? configuredExtensions)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(configuredExtensions))
        {
            return result;
        }

        var extensionSpec = configuredExtensions ?? string.Empty;
        var parts = extensionSpec.Split(new[] { ',', ';', ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var token = part.Trim();
            if (token.Length == 0)
            {
                continue;
            }

            if (token == "*" || token == ".*")
            {
                result.Add("*");
                continue;
            }

            if (!token.StartsWith(".", StringComparison.Ordinal))
            {
                token = "." + token;
            }

            result.Add(token.ToLowerInvariant());
        }

        return result;
    }

    private void UnsubscribeDocumentOpenEvents()
    {
        ThreadHelper.ThrowIfNotOnUIThread();

        if (_documentEvents is not null)
        {
            _documentEvents.DocumentOpened -= OnDocumentOpened;
            _documentEvents = null;
        }

        _waitingForSupportedDocument = false;
    }

    private (string Command, string Arguments, string ResolvedServerPath) ResolveLaunchCommand()
    {
        var options = WebComponentsPackage.Instance?.GetOptions();
        var preferNative = options?.PreferNativeBinary ?? true;
        var configuredNodePath = options?.NodePath;
        var nodePath = string.IsNullOrWhiteSpace(configuredNodePath) ? "node" : configuredNodePath!;

        var extensionRoot = Path.GetDirectoryName(typeof(WebComponentsLanguageClient).Assembly.Location)
            ?? AppContext.BaseDirectory;
        var binDirectory = Path.Combine(extensionRoot, "LanguageServer", "bin");

        var nativePath = ResolveNativeBinaryPath(binDirectory);
        if (preferNative && nativePath is not null && File.Exists(nativePath))
        {
            return (nativePath, string.Empty, nativePath);
        }

        var jsPath = Path.Combine(binDirectory, "wc-language-server.js");
        if (!File.Exists(jsPath))
        {
            throw new FileNotFoundException($"Language server entrypoint not found at '{jsPath}'.");
        }

        var quotedJsPath = QuoteIfNeeded(jsPath);
        return (nodePath, quotedJsPath, jsPath);
    }

    private static string? ResolveNativeBinaryPath(string binDirectory)
    {
        var suffix = GetPlatformSuffix();
        if (suffix is null)
        {
            return null;
        }

        var fileName = suffix.StartsWith("windows", StringComparison.Ordinal)
            ? $"wc-language-server-{suffix}.exe"
            : $"wc-language-server-{suffix}";

        return Path.Combine(binDirectory, fileName);
    }

    private static string? GetPlatformSuffix()
    {
        var architecture = RuntimeInformation.OSArchitecture;

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return architecture == Architecture.Arm64 ? "windows-arm64" : "windows-x64";
        }


        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            return architecture == Architecture.Arm64 ? "macos-arm64" : "macos-x64";
        }

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            return architecture == Architecture.Arm64 ? "linux-arm64" : "linux-x64";
        }

        return null;
    }

    private static string QuoteIfNeeded(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        return value.IndexOf(' ') >= 0 ? $"\"{value}\"" : value;
    }

    private static void Log(string message)
    {
        var options = WebComponentsPackage.Instance?.GetOptions();
        if (options?.EnableTraceLogging == true)
        {
            ActivityLog.TryLogInformation("WebComponentsLanguageServer", message);
        }
    }
}