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

# Step 1: Restore NuGet packages using the same VS Build Tools msbuild that will
# do the build. Mixing `dotnet restore` with VS Build Tools msbuild produces
# incompatible NuGet asset files and triggers "RuntimeIdentifier 'win' not listed"
# errors in Microsoft.NuGet.targets.
Write-Host "`nStep 1: Restoring dependencies..."
msbuild $projectFile /t:Restore /p:Configuration=$Configuration /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild restore failed" }

# Step 2: Build using VS Build Tools MSBuild (set up by microsoft/setup-msbuild).
# The .csproj uses the legacy project format which imports Microsoft.VsSDK.targets
# from $(VSToolsPath) — the same VSSDK installation used by Visual Studio. This is
# the only reliable way to trigger CreateVsixContainer. `dotnet build` does NOT work
# because it uses the .NET SDK's MSBuild which does not resolve $(VSToolsPath).
Write-Host "`nStep 2: Building project (msbuild)..."
msbuild $projectFile `
    /p:Configuration=$Configuration `
    /p:DeployExtension=false `
    /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild build failed" }

# Step 3: Locate the VSSDK-generated VSIX.
# Depending on the VSSDK version and project type the .vsix may land in:
#   - the project root directory
#   - bin\<Configuration>\
#   - bin\<Configuration>\<TFM>\
# Search the entire project tree and take the most-recently written .vsix.
Write-Host "`nStep 3: Locating VSSDK-generated VSIX..."
$generatedVsix = Get-ChildItem -Path $projectDir -Filter "*.vsix" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $generatedVsix) {
    Write-Host "No .vsix found. Listing project directory tree for diagnosis:"
    Get-ChildItem -Path $projectDir -Recurse -File |
        Select-Object -ExpandProperty FullName | Write-Host
    throw "VSSDK did not produce a .vsix file anywhere under $projectDir. " +
          "Ensure CreateVsixContainer=true is set in the .csproj and that " +
          "dotnet build completed successfully."
}

Write-Host "Found VSIX: $($generatedVsix.FullName) ($($generatedVsix.Length) bytes)"

# Step 4: Read manifest to determine the desired output filename.
Write-Host "`nStep 4: Reading manifest for naming..."
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

# Step 5: Copy the VSSDK-generated VSIX to the output path with the desired name.
Write-Host "`nStep 5: Copying VSIX to output..."
$outputVsixPath = Join-Path $OutputPath $vsixFileName
Copy-Item $generatedVsix.FullName $outputVsixPath -Force

Write-Host "`nVSIX ready!"
Write-Host "Path: $outputVsixPath"
Write-Host "Size: $((Get-Item $outputVsixPath).Length) bytes"
return $outputVsixPath
