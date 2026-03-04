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

dotnet msbuild $projectFile `
    /p:Configuration=$Configuration `
    /p:DeployExtension=false `
    /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "dotnet msbuild failed" }

$buildOutputDir = Join-Path $projectDir "bin\$Configuration"

# Step 2: Read manifest to get extension info
Write-Host "`nStep 2: Reading manifest..."
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

# Step 3: Find the VSSDK-generated VSIX
Write-Host "`nStep 3: Locating VSSDK-generated VSIX..."
$generatedVsix = Get-ChildItem -Path $buildOutputDir -Filter "*.vsix" -Recurse | Select-Object -First 1
if (-not $generatedVsix) {
    throw "No VSIX file found in $buildOutputDir. Ensure CreateVsixContainer=true in the project."
}
Write-Host "Found: $($generatedVsix.FullName)"

# Step 4: Copy to output with publisher-prefixed name
Write-Host "`nStep 4: Copying VSIX to output..."
$vsixPath = Join-Path $OutputPath $vsixFileName
if (Test-Path $vsixPath) { Remove-Item $vsixPath -Force }
Copy-Item $generatedVsix.FullName $vsixPath

Write-Host "`nVSIX created successfully!"
Write-Host "Path: $vsixPath"
Write-Host "Size: $((Get-Item $vsixPath).Length) bytes"

return $vsixPath
