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
using Newtonsoft.Json.Linq;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using StreamJsonRpc;

namespace WCToolkit.VisualStudio;

[Export(typeof(ILanguageClient))]
[PartCreationPolicy(CreationPolicy.Shared)]
[ContentType("text")]
public sealed class WebComponentsLanguageClient : ILanguageClient, ILanguageClientCustomMessage2
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
    private readonly List<FileSystemWatcher> _fileWatchers = new List<FileSystemWatcher>();
    private Timer? _restartDebounceTimer;
    private readonly object _restartTimerLock = new object();
    private const int RestartDebounceMs = 300;

    public static WebComponentsLanguageClient? Instance { get; private set; }

    public WebComponentsLanguageClient()
    {
        Instance = this;
        Log("WebComponentsLanguageClient constructor called");
    }

    public string Name => "Web Components Language Server";

    public IEnumerable<string> ConfigurationSections => new[] { "wctools" };

    public object? InitializationOptions => null;

    public IEnumerable<string> FilesToWatch => new[]
    {
        "**/wc.config.js",
        "**/custom-elements.json",
        "**/package.json"
    };

    public object? CustomMessageTarget => VsCustomMessageTarget.Instance;

    public object? MiddleLayer => VsCompatMiddleLayer.Instance;

    public bool ShowNotificationOnInitializeFailed => true;

    public event AsyncEventHandler<EventArgs>? StartAsync;

    public event AsyncEventHandler<EventArgs>? StopAsync;

    public Task AttachForCustomMessageAsync(JsonRpc rpc)
    {
        return Task.CompletedTask;
    }

    public async Task OnLoadedAsync()
    {
        Log($"OnLoadedAsync called, StartAsync={(this.StartAsync is null ? "null" : "subscribed")}");

        if (this.StartAsync is null)
        {
            Log("StartAsync is null - language client broker has not subscribed. Client will not start.");
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
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(token);
        var workspaceRoot = ResolveWorkspaceRoot();
        Log($"ActivateAsync: workspaceRoot={( string.IsNullOrWhiteSpace(workspaceRoot) ? "(none)" : workspaceRoot)}");
        await TaskScheduler.Default;

        try
        {
            var launch = ResolveLaunchCommand();
            Log($"ActivateAsync: resolved command={launch.Command} args={launch.Arguments}");

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
                WorkingDirectory = !string.IsNullOrWhiteSpace(workspaceRoot)
                    ? workspaceRoot
                    : Path.GetDirectoryName(launch.ResolvedServerPath) ?? AppContext.BaseDirectory
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

            var launched = $"started language server: {launch.Command} {launch.Arguments}".Trim();
            Log(launched);

            return new Connection(_serverProcess.StandardOutput.BaseStream, _serverProcess.StandardInput.BaseStream);
        }
        catch (Exception ex)
        {
            var msg = $"failed to activate language server: {ex.Message}";
            Log(msg);
            Log($"Full exception: {ex}");
            return null;
        }
    }

    public async Task OnServerInitializedAsync()
    {
        Log("server initialized");
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        var workspaceRoot = ResolveWorkspaceRoot();
        SetupFileWatchers(workspaceRoot);
    }

    private void SetupFileWatchers(string workspaceRoot)
    {
        DisposeFileWatchers();

        if (string.IsNullOrWhiteSpace(workspaceRoot) || !Directory.Exists(workspaceRoot))
        {
            return;
        }

        var patterns = new[] { "wc.config.*", "custom-elements.json", "package.json" };
        foreach (var pattern in patterns)
        {
            try
            {
                var watcher = new FileSystemWatcher(workspaceRoot, pattern)
                {
                    IncludeSubdirectories = true,
                    NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName,
                    EnableRaisingEvents = true
                };
                watcher.Changed += OnWatchedFileChanged;
                watcher.Created += OnWatchedFileChanged;
                watcher.Deleted += OnWatchedFileChanged;
                watcher.Renamed += (s, e) => OnWatchedFileChanged(s, e);
                _fileWatchers.Add(watcher);
            }
            catch (Exception ex)
            {
                Log($"failed to set up file watcher for {pattern}: {ex.Message}");
            }
        }

        Log($"watching {workspaceRoot} for config/manifest changes");
    }

    private void OnWatchedFileChanged(object sender, FileSystemEventArgs e)
    {
        Log($"watched file changed: {e.Name}");
        ScheduleRestart($"file changed: {e.Name}");
    }

    private void ScheduleRestart(string reason)
    {
        Log($"restart scheduled: {reason}");
        lock (_restartTimerLock)
        {
            _restartDebounceTimer?.Dispose();
            _restartDebounceTimer = new Timer(
                _ => ThreadHelper.JoinableTaskFactory.Run(async () => await RequestRestartAsync()),
                null,
                RestartDebounceMs,
                Timeout.Infinite);
        }
    }

    private void DisposeFileWatchers()
    {
        lock (_restartTimerLock)
        {
            _restartDebounceTimer?.Dispose();
            _restartDebounceTimer = null;
        }

        foreach (var watcher in _fileWatchers)
        {
            try
            {
                watcher.EnableRaisingEvents = false;
                watcher.Dispose();
            }
            catch { }
        }

        _fileWatchers.Clear();
    }

    public Task<InitializationFailureContext?> OnServerInitializeFailedAsync(ILanguageClientInitializationInfo initializationState)
    {
        Log($"server initialize failed: {initializationState.StatusMessage}");
        return Task.FromResult<InitializationFailureContext?>(null);
    }

    public async Task RequestRestartAsync()
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        DisposeFileWatchers();
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

    private string ResolveWorkspaceRoot()
    {
        ThreadHelper.ThrowIfNotOnUIThread();

        try
        {
            var dte = _dte;
            if (dte is null)
            {
                dte = Package.GetGlobalService(typeof(DTE)) as DTE2;
            }

            var solutionPath = dte?.Solution?.FullName;
            if (!string.IsNullOrWhiteSpace(solutionPath))
            {
                // In Open Folder mode (no .sln) VS sets Solution.FullName to the folder
                // itself, so we use it directly. For a real .sln file we take its parent.
                return Directory.Exists(solutionPath)
                    ? solutionPath
                    : Path.GetDirectoryName(solutionPath) ?? string.Empty;
            }
        }
        catch { }

        return string.Empty;
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
        if (preferNative && IsValidNativeBinary(nativePath))
        {
            return (nativePath!, "--stdio", nativePath!);
        }

        var jsPath = Path.Combine(binDirectory, "wc-language-server.js");
        if (!File.Exists(jsPath))
        {
            throw new FileNotFoundException($"Language server entrypoint not found at '{jsPath}'.");
        }

        var quotedJsPath = QuoteIfNeeded(jsPath);
        return (nodePath, $"{quotedJsPath} --stdio", jsPath);
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

    private static bool IsValidNativeBinary(string? path)
    {
        if (path is null || !File.Exists(path))
        {
            return false;
        }

        try
        {
            using var fs = new FileStream(path, FileMode.Open, FileAccess.Read);
            if (fs.Length < 64)
            {
                return false;
            }

            var header = new byte[2];
            fs.Read(header, 0, 2);
            return header[0] == 0x4D && header[1] == 0x5A; // MZ
        }
        catch
        {
            return false;
        }
    }

    private static string? GetPlatformSuffix()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return RuntimeInformation.OSArchitecture == Architecture.Arm64
                ? "windows-arm64"
                : "windows-x64";
        }

        var architecture = RuntimeInformation.OSArchitecture;

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

    // VS does not support pull-based diagnostics (LSP 3.17 textDocument/diagnostic) nor
    // client/registerCapability.  Volar advertises diagnosticProvider in the initialize
    // response which causes VS to expect the pull model and never show any diagnostics.
    // This layer removes that capability so Volar falls back to push-based
    // textDocument/publishDiagnostics which VS does support.
    private sealed class VsCompatMiddleLayer : ILanguageClientMiddleLayer
    {
        internal static readonly VsCompatMiddleLayer Instance = new VsCompatMiddleLayer();
        private VsCompatMiddleLayer() { }

        // Handle every method so we can intercept initialize and log unknown notifications.
        public bool CanHandle(string methodName) => true;

        public Task HandleNotificationAsync(string methodName, JToken methodParam, Func<JToken, Task> sendNotification)
        {
            Log($"server notification: {methodName}");
            return sendNotification(methodParam);
        }

        public async Task<JToken> HandleRequestAsync(string methodName, JToken methodParam, Func<JToken, Task<JToken>> sendRequest)
        {
            Log($"server request: {methodName}");
            var result = await sendRequest(methodParam);
            if (methodName == "initialize" && result is JObject resultObj)
            {
                // VS only supports push-based textDocument/publishDiagnostics, not the
                // pull-based diagnosticProvider (LSP 3.17 textDocument/diagnostic).
                // Removing this capability causes Volar to fall back to push-based diagnostics.
                (resultObj["capabilities"] as JObject)?.Remove("diagnosticProvider");
                Log($"initialize result capabilities: {resultObj["capabilities"]}");
            }
            return result;
        }
    }

    private sealed class VsCustomMessageTarget
    {
        internal static readonly VsCustomMessageTarget Instance = new VsCustomMessageTarget();
        private VsCustomMessageTarget() { }

        public void NotificationReceived(JToken payload)
        {
            Log($"custom notification payload: {payload}");
        }
    }

    private static void Log(string message)
    {
        ActivityLog.TryLogInformation("WebComponentsLanguageServer", message);
        System.Diagnostics.Debug.WriteLine($"[WCLanguageServer] {message}");

        try
        {
            var logFile = Path.Combine(Path.GetTempPath(), "wc-language-server-vs.log");
            var line = $"{DateTime.Now:HH:mm:ss.fff} {message}{Environment.NewLine}";
            File.AppendAllText(logFile, line);
        }
        catch { }
    }
}