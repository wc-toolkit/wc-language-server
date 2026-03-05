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

# Step 1: Restore and build (compiles the assembly; VSSDK CreateVsixContainer
# does not exist in SDK-style projects so we assemble the VSIX ourselves).
Write-Host "`nStep 1: Building project..."
msbuild $projectFile /t:Restore /p:Configuration=$Configuration /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild restore failed" }

msbuild $projectFile `
    /p:Configuration=$Configuration `
    /p:DeployExtension=false `
    /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild build failed" }

$buildOutputDir = Join-Path $projectDir "bin\$Configuration\net472"
$assemblyName = "WebComponentsLanguageServer.VisualStudio"

# Step 2: Read source manifest
Write-Host "`nStep 2: Reading manifest..."
[xml]$manifest = Get-Content $manifestFile
$ns = New-Object System.Xml.XmlNamespaceManager($manifest.NameTable)
$ns.AddNamespace("vs", "http://schemas.microsoft.com/developer/vsx-schema/2011")

$identity = $manifest.SelectSingleNode("//vs:PackageManifest/vs:Metadata/vs:Identity", $ns)
$publisher = $identity.Publisher
$id = $identity.Id
$version = $identity.Version
$vsixFileName = "$publisher.$id.vsix"

Write-Host "Extension:  $id"
Write-Host "Publisher:  $publisher"
Write-Host "Version:    $version"
Write-Host "VSIX Name:  $vsixFileName"

# Step 3: Stage VSIX contents
# SDK-style projects with Microsoft.VSSDK.BuildTools don't expose CreateVsixContainer
# as a callable target, so we assemble the VSIX package ourselves. This produces a
# well-formed VSIX v3 container that passes VS Marketplace validation.
Write-Host "`nStep 3: Staging VSIX contents..."
$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

try {
    # --- extension.vsixmanifest (resolved — no MSBuild template tokens) ---
    $pkgdefPath = Join-Path $buildOutputDir "$assemblyName.pkgdef"
    $hasPkgdef = Test-Path $pkgdefPath
    $pkgdefAsset = if ($hasPkgdef) { "<Asset Type=`"Microsoft.VisualStudio.VsPackage`" Path=`"$assemblyName.pkgdef`" />" } else { "" }

    $resolvedManifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="$id" Version="$version" Language="en-US" Publisher="$publisher" />
    <DisplayName>Web Components Language Server</DisplayName>
    <Description xml:space="preserve">Language Server Protocol integration for Web Components and Custom Elements in Visual Studio.</Description>
    <Icon>assets/icon.png</Icon>
    <License>LICENSE</License>
    <MoreInfo>https://github.com/wc-toolkit/wc-language-server</MoreInfo>
    <ReleaseNotes>https://github.com/wc-toolkit/wc-language-server/releases</ReleaseNotes>
    <Tags>web components;custom elements;language server;lsp;html;typescript;javascript</Tags>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Community" Version="[17.0,18.0)" />
    <InstallationTarget Id="Microsoft.VisualStudio.Pro" Version="[17.0,18.0)" />
    <InstallationTarget Id="Microsoft.VisualStudio.Enterprise" Version="[17.0,18.0)" />
  </Installation>
  <Dependencies>
    <Dependency Id="Microsoft.Framework.NDP" DisplayName=".NET Framework" Version="[4.7.2,)" />
  </Dependencies>
  <Prerequisites>
    <Prerequisite Id="Microsoft.VisualStudio.Component.CoreEditor" Version="[17.0,18.0)" DisplayName="Visual Studio core editor" />
  </Prerequisites>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.MefComponent" Path="$assemblyName.dll" />
    $pkgdefAsset
  </Assets>
</PackageManifest>
"@
    [System.IO.File]::WriteAllText(
        (Join-Path $stagingDir "extension.vsixmanifest"),
        $resolvedManifest,
        [System.Text.Encoding]::UTF8)

    # --- Extension assembly ---
    Copy-Item (Join-Path $buildOutputDir "$assemblyName.dll") $stagingDir

    # --- Pkgdef (VS package registration) ---
    if ($hasPkgdef) { Copy-Item $pkgdefPath $stagingDir }

    # --- Language server binaries ---
    $lsBinDir = Join-Path $stagingDir "LanguageServer\bin"
    New-Item -ItemType Directory -Force -Path $lsBinDir | Out-Null
    $sourceLsBinDir = Join-Path $buildOutputDir "LanguageServer\bin"
    if (Test-Path $sourceLsBinDir) {
        Get-ChildItem $sourceLsBinDir -File |
            Where-Object { $_.Extension -in @('.exe', '.js') } |
            ForEach-Object { Copy-Item $_.FullName $lsBinDir }
    }

    # --- Assets (icon) ---
    $sourceAssetsDir = Join-Path $projectDir "assets"
    if (Test-Path $sourceAssetsDir) {
        $assetsDir = Join-Path $stagingDir "assets"
        New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
        Get-ChildItem $sourceAssetsDir -File | ForEach-Object { Copy-Item $_.FullName $assetsDir }
    }

    # --- LICENSE ---
    $licenseFile = Join-Path $projectDir "LICENSE"
    if (Test-Path $licenseFile) { Copy-Item $licenseFile $stagingDir }

    # --- [Content_Types].xml ---
    $allFiles = Get-ChildItem $stagingDir -Recurse -File
    $extMap = @{
        vsixmanifest = 'text/xml'; xml = 'text/xml'
        dll  = 'application/octet-stream'; exe = 'application/octet-stream'
        js   = 'application/javascript';   pkgdef = 'text/plain'
        txt  = 'text/plain';               png = 'image/png'
        json = 'application/json';
    }
    $seenExts = @{}
    foreach ($f in $allFiles) {
        $ext = $f.Extension.TrimStart('.')
        if ($ext -and -not $seenExts[$ext]) { $seenExts[$ext] = $true }
    }
    $defaults = $seenExts.Keys | ForEach-Object {
        $ct = if ($extMap[$_]) { $extMap[$_] } else { 'application/octet-stream' }
        "  <Default Extension=""$_"" ContentType=""$ct"" />"
    }
    $contentTypes = "<?xml version=""1.0"" encoding=""utf-8""?>`n<Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types"">`n" +
        ($defaults -join "`n") + "`n</Types>"
    [System.IO.File]::WriteAllText(
        (Join-Path $stagingDir "[Content_Types].xml"),
        $contentTypes,
        [System.Text.Encoding]::UTF8)

    # --- VSIX v3: catalog.json + manifest.json (required for VS 2017+ marketplace) ---
    $stagedFiles = Get-ChildItem $stagingDir -Recurse -File
    $totalSize   = ($stagedFiles | Measure-Object -Property Length -Sum).Sum
    $fileEntries = $stagedFiles | ForEach-Object {
        [ordered]@{ fileName = '/' + ($_.FullName.Substring($stagingDir.Length).TrimStart('\').Replace('\', '/')) }
    }

    $catalogObj = [ordered]@{
        manifestVersion = '1.1'
        info = [ordered]@{ id = "$id,version=$version"; manifestType = 'Extension' }
        packages = @([ordered]@{
            id           = $id
            version      = $version
            type         = 'Vsix'
            extensionDir = '[installdir]'
            files        = @($fileEntries)
            dependencies = [ordered]@{}
            msiProperties = [ordered]@{}
        })
    }
    $catalogObj | ConvertTo-Json -Depth 10 |
        Set-Content (Join-Path $stagingDir "catalog.json") -Encoding UTF8

    $manifestObj = [ordered]@{
        id          = $id
        version     = $version
        type        = 'Vsix'
        vsixId      = $id
        displayName = 'Web Components Language Server'
        description = 'Language Server Protocol integration for Web Components and Custom Elements in Visual Studio.'
        installSizes = [ordered]@{ targetDrive = [int]$totalSize }
    }
    $manifestObj | ConvertTo-Json -Depth 5 |
        Set-Content (Join-Path $stagingDir "manifest.json") -Encoding UTF8

    # Step 4: Zip into VSIX
    Write-Host "`nStep 4: Packaging VSIX..."
    Write-Host "Staged files:"
    Get-ChildItem $stagingDir -Recurse -File | ForEach-Object {
        Write-Host "  $($_.FullName.Substring($stagingDir.Length).TrimStart('\'))  ($($_.Length) bytes)"
    }

    $outputVsixPath = Join-Path $OutputPath $vsixFileName
    if (Test-Path $outputVsixPath) { Remove-Item $outputVsixPath -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingDir, $outputVsixPath,
        [System.IO.Compression.CompressionLevel]::Optimal, $false)

    Write-Host "`nVSIX ready!"
    Write-Host "Path: $outputVsixPath"
    Write-Host "Size: $((Get-Item $outputVsixPath).Length) bytes"
    return $outputVsixPath
}
finally {
    if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
}
