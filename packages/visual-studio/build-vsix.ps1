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
dotnet restore $projectFile
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }

dotnet msbuild $projectFile `
    /p:Configuration=$Configuration `
    /p:DeployExtension=false `
    /v:minimal
if ($LASTEXITCODE -ne 0) { throw "dotnet msbuild failed" }

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
$vsixFileName = "$publisher.$id.vsix"

Write-Host "Extension: $id"
Write-Host "Publisher: $publisher"
Write-Host "Version: $version"
Write-Host "VSIX Name: $vsixFileName"

# Step 3: Create temporary VSIX staging directory
Write-Host "`nStep 3: Creating VSIX staging directory..."
$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

try {
    # Copy manifest
    Copy-Item $manifestFile (Join-Path $stagingDir "extension.vsixmanifest")
    
    # Copy main assembly and dependencies
    Get-ChildItem -Path $buildOutputDir -Filter "*.dll" | ForEach-Object {
        Copy-Item $_.FullName $stagingDir
    }
    
    # Copy pkgdef
    Get-ChildItem -Path $buildOutputDir -Filter "*.pkgdef" | ForEach-Object {
        Copy-Item $_.FullName $stagingDir
    }
    
    # Copy language server binaries
    $lsBinDir = Join-Path $stagingDir "LanguageServer\bin"
    New-Item -ItemType Directory -Force -Path $lsBinDir | Out-Null
    
    $sourceLsBinDir = Join-Path $buildOutputDir "LanguageServer\bin"
    if (Test-Path $sourceLsBinDir) {
        Get-ChildItem -Path $sourceLsBinDir -File | ForEach-Object {
            Copy-Item $_.FullName $lsBinDir
        }
    }
    
    # Copy assets
    $assetsDir = Join-Path $stagingDir "assets"
    New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
    
    $sourceAssetsDir = Join-Path $projectDir "assets"
    if (Test-Path $sourceAssetsDir) {
        Get-ChildItem -Path $sourceAssetsDir -File | ForEach-Object {
            Copy-Item $_.FullName $assetsDir
        }
    }
    
    # Copy LICENSE
    $licenseFile = Join-Path $projectDir "LICENSE"
    if (Test-Path $licenseFile) {
        Copy-Item $licenseFile $stagingDir
    }
    
    # Create [Content_Types].xml
    $contentTypesXml = @"
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Default Extension="dll" ContentType="application/octet-stream" />
  <Default Extension="exe" ContentType="application/octet-stream" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="pkgdef" ContentType="text/plain" />
  <Default Extension="txt" ContentType="text/plain" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="jpg" ContentType="image/jpeg" />
  <Default Extension="jpeg" ContentType="image/jpeg" />
</Types>
"@
    $contentTypesPath = Join-Path $stagingDir "[Content_Types].xml"
    [System.IO.File]::WriteAllText($contentTypesPath, $contentTypesXml, [System.Text.Encoding]::UTF8)
    
    # Step 4: Package as VSIX (ZIP)
    Write-Host "`nStep 4: Creating VSIX package..."
    $vsixPath = Join-Path $OutputPath $vsixFileName
    
    # Remove existing VSIX if present
    if (Test-Path $vsixPath) {
        Remove-Item $vsixPath -Force
    }
    
    # Create ZIP file (VSIX is just a renamed ZIP)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $vsixPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    
    Write-Host "`nVSIX created successfully!"
    Write-Host "Path: $vsixPath"
    Write-Host "Size: $((Get-Item $vsixPath).Length) bytes"
    
    return $vsixPath
}
finally {
    # Clean up staging directory
    if (Test-Path $stagingDir) {
        Remove-Item -Path $stagingDir -Recurse -Force
    }
}
