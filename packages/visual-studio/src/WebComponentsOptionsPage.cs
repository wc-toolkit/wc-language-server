using System.ComponentModel;
using Microsoft.VisualStudio.Shell;

namespace WCToolkit.VisualStudio;

public enum ActivationScope
{
    AnyText,
    WebComponentFileTypes
}

public class WebComponentsOptionsPage : DialogPage
{
    public const string DefaultSupportedExtensions = "*";

    [Category("Language Server")]
    [DisplayName("Activation Scope")]
    [Description("Controls when the language server starts. AnyText starts on any text-based file. WebComponentFileTypes waits until a supported web-component related file is opened.")]
    [DefaultValue(ActivationScope.AnyText)]
    public ActivationScope ActivationScope { get; set; } = ActivationScope.AnyText;

    [Category("Language Server")]
    [DisplayName("Supported File Extensions")]
    [Description("Comma or semicolon separated list of file extensions used when Activation Scope is WebComponentFileTypes. Use '*' to allow any extension (default). Example: .html,.js,.ts,.vue")]
    [DefaultValue(DefaultSupportedExtensions)]
    public string SupportedFileExtensions { get; set; } = DefaultSupportedExtensions;

    [Category("Language Server")]
    [DisplayName("Prefer Native Binary")]
    [Description("Use the bundled native wc-language-server executable for the current OS/architecture when available.")]
    [DefaultValue(true)]
    public bool PreferNativeBinary { get; set; } = true;

    [Category("Language Server")]
    [DisplayName("Node.js Path")]
    [Description("Path to Node.js executable. Used when native binary is unavailable or disabled.")]
    [DefaultValue("node")]
    public string NodePath { get; set; } = "node";

    [Category("Language Server")]
    [DisplayName("Enable Trace Logging")]
    [Description("Write language client diagnostic messages to the Visual Studio Activity Log.")]
    [DefaultValue(false)]
    public bool EnableTraceLogging { get; set; }
}