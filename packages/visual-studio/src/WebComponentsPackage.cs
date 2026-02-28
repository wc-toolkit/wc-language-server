using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace WCToolkit.VisualStudio;

[PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
[InstalledProductRegistration("Web Components Language Server", "Web Components language support powered by LSP", "0.1.0")]
[ProvideMenuResource("Menus.ctmenu", 1)]
[ProvideOptionPage(typeof(WebComponentsOptionsPage), "Web Components", "Language Server", 0, 0, true)]
[Guid(PackageGuids.PackageGuidString)]
public sealed class WebComponentsPackage : AsyncPackage
{
    internal static WebComponentsPackage? Instance { get; private set; }

    protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
    {
        Instance = this;

        await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

        if (await GetServiceAsync(typeof(IMenuCommandService)) is OleMenuCommandService commandService)
        {
            var restartCommand = new OleMenuCommand((_, _) =>
                JoinableTaskFactory.RunAsync(async () => await RestartLanguageServerAsync()).FileAndForget("WCToolkit/RestartLanguageServer"),
                new CommandID(new Guid(PackageGuids.CommandSetGuidString), PackageIds.RestartLanguageServerCommandId));
            commandService.AddCommand(restartCommand);

            var statusCommand = new OleMenuCommand((_, _) => ShowLanguageServerStatus(),
                new CommandID(new Guid(PackageGuids.CommandSetGuidString), PackageIds.ShowLanguageServerStatusCommandId));
            commandService.AddCommand(statusCommand);
        }
    }

    internal WebComponentsOptionsPage GetOptions() => (WebComponentsOptionsPage)GetDialogPage(typeof(WebComponentsOptionsPage));

    private async Task RestartLanguageServerAsync()
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

        if (WebComponentsLanguageClient.Instance is null)
        {
            VsShellUtilities.ShowMessageBox(
                this,
                "The language client has not been created yet. Open an HTML file to activate it.",
                "Web Components Language Server",
                OLEMSGICON.OLEMSGICON_INFO,
                OLEMSGBUTTON.OLEMSGBUTTON_OK,
                OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
            return;
        }

        await WebComponentsLanguageClient.Instance.RequestRestartAsync();

        VsShellUtilities.ShowMessageBox(
            this,
            "Restart request sent to Web Components Language Server.",
            "Web Components Language Server",
            OLEMSGICON.OLEMSGICON_INFO,
            OLEMSGBUTTON.OLEMSGBUTTON_OK,
            OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
    }

    private void ShowLanguageServerStatus()
    {
        ThreadHelper.ThrowIfNotOnUIThread();

        if (WebComponentsLanguageClient.Instance is null)
        {
            VsShellUtilities.ShowMessageBox(
                this,
                "Language client is not active yet. Open a supported file to start it.",
                "Web Components Language Server",
                OLEMSGICON.OLEMSGICON_INFO,
                OLEMSGBUTTON.OLEMSGBUTTON_OK,
                OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
            return;
        }

        var status = WebComponentsLanguageClient.Instance.GetStatus();

        VsShellUtilities.ShowMessageBox(
            this,
            status,
            "Web Components Language Server",
            OLEMSGICON.OLEMSGICON_INFO,
            OLEMSGBUTTON.OLEMSGBUTTON_OK,
            OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
    }
}