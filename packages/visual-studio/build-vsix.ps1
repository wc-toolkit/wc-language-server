param(
    [Parameter(Mandatory=$true)]
    [string]$OutputPath,
    
    [Parameter(Mandatory=$false)]
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

Write-Host "Building Visual Studio VSIX package..."
Write-Host "Configuration: $Configuration"
Write-Host "Output Path: $OutputPath"

$projectDir = $PSScriptRoot
$projectFile = Join-Path $projectDir "WebComponentsLanguageServer.VisualStudio.csproj"
$manifestFile = Join-Path $projectDir "source.extension.vsixmanifest"

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

# Step 1: Build the project
Write-Host "`nStep 1: Building project..."
dotnet restore $projectFile | Out-Host
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }

msbuild $projectFile `
    /p:Configuration=$Configuration `
    /p:DeployExtension=false `
    /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild failed" }

$buildOutputDir = Join-Path $projectDir "bin\$Configuration\net472"

# Step 2: Read manifest to get extension info
Write-Host "`nStep 2: Reading manifest..."
[xml]$manifest = Get-Content $manifestFile
$ns = New-Object System.Xml.XmlNamespaceManager($manifest.NameTable)
$ns.AddNamespace("vs", "http://schemas.microsoft.com/developer/vsx-schema/2011")

$identity = $manifest.SelectSingleNode("//vs:PackageManifest/vs:Metadata/vs:Identity", $ns)
$publisher = $identity.Publisher
$id = $identity.Id
$version = $identity.Version
$assemblyName = "WebComponentsLanguageServer.VisualStudio"
$vsixFileName = "$publisher.$id.vsix"

Write-Host "Extension: $id"
Write-Host "Publisher: $publisher"
Write-Host "Version: $version"
Write-Host "VSIX Name: $vsixFileName"

# Step 3: Stage VSIX contents
Write-Host "`nStep 3: Staging VSIX contents..."
$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

try {
    # Write resolved manifest (replace MSBuild template placeholders with actual paths)
    $resolvedManifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="$id" Version="$version" Language="en-US" Publisher="$publisher" />
    <DisplayName>Web Components Language Server</DisplayName>
    <Description xml:space="preserve">Language Server Protocol integration for Web Components and Custom Elements in Visual Studio.</Description>
    <MoreInfo>https://github.com/wc-toolkit/wc-language-server</MoreInfo>
    <ReleaseNotes>https://github.com/wc-toolkit/wc-language-server/releases</ReleaseNotes>
    <Tags>web components;custom elements;language server;lsp;html;typescript;javascript</Tags>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Community" Version="[17.0,)" />
    <InstallationTarget Id="Microsoft.VisualStudio.Pro" Version="[17.0,)" />
    <InstallationTarget Id="Microsoft.VisualStudio.Enterprise" Version="[17.0,)" />
  </Installation>
  <Prerequisites>
    <Prerequisite Id="Microsoft.VisualStudio.Component.CoreEditor" Version="[17.0,)" DisplayName="Visual Studio core editor" />
  </Prerequisites>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.MefComponent" Path="$assemblyName.dll" />
    $(if (Test-Path (Join-Path $buildOutputDir "$assemblyName.pkgdef")) { "<Asset Type=`"Microsoft.VisualStudio.VsPackage`" Path=`"$assemblyName.pkgdef`" />" })
  </Assets>
</PackageManifest>
"@
    [System.IO.File]::WriteAllText((Join-Path $stagingDir "extension.vsixmanifest"), $resolvedManifest, [System.Text.Encoding]::UTF8)

    # Copy main assembly
    Copy-Item (Join-Path $buildOutputDir "$assemblyName.dll") $stagingDir

    # Copy pkgdef if present
    $pkgdef = Join-Path $buildOutputDir "$assemblyName.pkgdef"
    if (Test-Path $pkgdef) { Copy-Item $pkgdef $stagingDir }

    # Copy language server binaries (Windows only)
    $lsBinDir = Join-Path $stagingDir "LanguageServer\bin"
    New-Item -ItemType Directory -Force -Path $lsBinDir | Out-Null
    $sourceLsBinDir = Join-Path $buildOutputDir "LanguageServer\bin"
    if (Test-Path $sourceLsBinDir) {
        Get-ChildItem $sourceLsBinDir -File | Where-Object { $_.Extension -in @('.exe','.js') } | ForEach-Object { Copy-Item $_.FullName $lsBinDir }
    }

    # Copy assets
    $sourceAssetsDir = Join-Path $projectDir "assets"
    if (Test-Path $sourceAssetsDir) {
        $assetsDir = Join-Path $stagingDir "assets"
        New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
        Get-ChildItem $sourceAssetsDir -File | ForEach-Object { Copy-Item $_.FullName $assetsDir }
    }

    # Build [Content_Types].xml dynamically
    $extensionMap = @{ vsixmanifest='text/xml'; xml='text/xml'; dll='application/octet-stream'; exe='application/octet-stream'; js='application/javascript'; pkgdef='text/plain'; txt='text/plain'; png='image/png' }
    $allFiles = Get-ChildItem $stagingDir -Recurse -File
    $seenExt = @{}; $overrides = @()
    foreach ($f in $allFiles) {
        $ext = $f.Extension.TrimStart('.')
        $rel = '/' + ($f.FullName.Substring($stagingDir.Length).TrimStart('\').Replace('\','/'))
        if ([string]::IsNullOrEmpty($ext)) { $overrides += "  <Override PartName=""$rel"" ContentType=""application/octet-stream"" />" }
        elseif (-not $seenExt[$ext]) { $seenExt[$ext] = $true }
    }
    $defaults = $seenExt.Keys | ForEach-Object { "  <Default Extension=""$_"" ContentType=""$(if($extensionMap[$_]){$extensionMap[$_]}else{'application/octet-stream'})"" />" }
    $ct = "<?xml version=""1.0"" encoding=""utf-8""?>`n<Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types"">`n" + ($defaults -join "`n") + "`n" + ($overrides -join "`n") + "`n</Types>"
    [System.IO.File]::WriteAllText((Join-Path $stagingDir "[Content_Types].xml"), $ct, [System.Text.Encoding]::UTF8)

    # Step 4: Package as VSIX
    Write-Host "`nStep 4: Creating VSIX package..."
    $vsixPath = Join-Path $OutputPath $vsixFileName
    if (Test-Path $vsixPath) { Remove-Item $vsixPath -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $vsixPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

    Write-Host "`nVSIX created successfully!"
    Write-Host "Path: $vsixPath"
    Write-Host "Size: $((Get-Item $vsixPath).Length) bytes"
    return $vsixPath
}
finally {
    if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
}
