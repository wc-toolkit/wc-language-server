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

# Step 1: Build the project (VSSDK produces the VSIX via CreateVsixContainer)
Write-Host "`nStep 1: Building project..."
dotnet restore $projectFile | Out-Host
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }

msbuild $projectFile `
    /p:Configuration=$Configuration `
    /p:DeployExtension=false `
    /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild failed" }

# Step 2: Find the VSSDK-generated VSIX
Write-Host "`nStep 2: Locating VSSDK-generated VSIX..."
$buildOutputDir = Join-Path $projectDir "bin\$Configuration"
$generatedVsix = Get-ChildItem -Path $buildOutputDir -Filter "*.vsix" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $generatedVsix) {
    throw "VSSDK did not produce a .vsix file under $buildOutputDir. Check that CreateVsixContainer is true in the .csproj."
}

Write-Host "Found VSIX: $($generatedVsix.FullName) ($($generatedVsix.Length) bytes)"

# Step 3: Read manifest to determine the desired output filename
Write-Host "`nStep 3: Reading manifest for naming..."
[xml]$manifest = Get-Content $manifestFile
$ns = New-Object System.Xml.XmlNamespaceManager($manifest.NameTable)
$ns.AddNamespace("vs", "http://schemas.microsoft.com/developer/vsx-schema/2011")

$identity = $manifest.SelectSingleNode("//vs:PackageManifest/vs:Metadata/vs:Identity", $ns)
$publisher = $identity.Publisher
$id = $identity.Id
$version = $identity.Version
$vsixFileName = "$publisher.$id.vsix"

Write-Host "Extension: $id"
Write-Host "Publisher: $publisher"
Write-Host "Version: $version"
Write-Host "VSIX Name: $vsixFileName"

# Step 4: Copy to output path with the desired name
Write-Host "`nStep 4: Copying VSIX to output..."
$vsixPath = Join-Path $OutputPath $vsixFileName
Copy-Item $generatedVsix.FullName $vsixPath -Force

Write-Host "`nVSIX ready!"
Write-Host "Path: $vsixPath"
Write-Host "Size: $((Get-Item $vsixPath).Length) bytes"
return $vsixPath
