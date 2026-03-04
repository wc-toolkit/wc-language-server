$ErrorActionPreference = "Stop"

if ($IsLinux -or $IsMacOS) {
  Write-Error "validate-vsix.ps1 requires Windows with Visual Studio installed. VsixPublisher.exe is not available on this platform."
  exit 1
}

if (-not (Get-Command msbuild -ErrorAction SilentlyContinue)) {
  Write-Error "msbuild not found. Open this script from a Visual Studio Developer PowerShell, or run 'Import-Module VSSetup' first."
  exit 1
}

$outputPath = Join-Path $PSScriptRoot "..\..\local-vsix-output"
$binPath = Join-Path $PSScriptRoot "..\language-server\bin"

# Create stub binaries if not present so the build doesn't fail locally
$stubs = @(
  "wc-language-server.js",
  "wc-language-server-windows-x64.exe"
)
$createdStubs = @()
New-Item -ItemType Directory -Force -Path $binPath | Out-Null
foreach ($stub in $stubs) {
  $stubPath = Join-Path $binPath $stub
  if (-not (Test-Path $stubPath)) {
    "stub" | Set-Content $stubPath
    $createdStubs += $stubPath
    Write-Host "Created stub: $stub" -ForegroundColor DarkGray
  }
}

# Step 1: Build the VSIX
Write-Host "Building VSIX..." -ForegroundColor Cyan
$vsixPath = ./build-vsix.ps1 -OutputPath $outputPath -Configuration Release

# Step 2: Read manifest metadata
Write-Host "`nReading manifest metadata..." -ForegroundColor Cyan
[xml]$manifest = Get-Content (Join-Path $PSScriptRoot "source.extension.vsixmanifest")
$ns = New-Object System.Xml.XmlNamespaceManager($manifest.NameTable)
$ns.AddNamespace("vs", "http://schemas.microsoft.com/developer/vsx-schema/2011")
$identity = $manifest.SelectSingleNode("//vs:PackageManifest/vs:Metadata/vs:Identity", $ns)
$publisher = $identity.Publisher
$internalName = $identity.Id -replace '[^a-zA-Z0-9-]', '-'

# Step 4: Validate VSIX structure
Write-Host "`nValidating VSIX structure..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)
$entries = $zip.Entries | Select-Object -ExpandProperty FullName
$zip.Dispose()

$required = @('extension.vsixmanifest', '[Content_Types].xml')
foreach ($file in $required) {
  if ($entries -notcontains $file) { Write-Error "Missing required file in VSIX: $file"; exit 1 }
  Write-Host "  [OK] $file" -ForegroundColor Green
}
Write-Host "  [OK] $($entries.Count) total entries" -ForegroundColor Green

# Step 5: Validate publish manifest fields
Write-Host "`nValidating publish manifest fields..." -ForegroundColor Cyan
$internalName = $identity.Id -replace '[^a-zA-Z0-9-]', '-'

if ($internalName.Length -ge 63) {
  Write-Error "internalName is too long ($($internalName.Length) chars, max 63): $internalName"
  exit 1
}
if ($internalName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9-]*$') {
  Write-Error "internalName contains invalid characters: $internalName"
  exit 1
}
if ([string]::IsNullOrWhiteSpace($publisher)) {
  Write-Error "publisher is empty"
  exit 1
}

Write-Host "  [OK] publisher:     $publisher" -ForegroundColor Green
Write-Host "  [OK] internalName:  $internalName ($($internalName.Length) chars)" -ForegroundColor Green
Write-Host "  [OK] version:       $($identity.Version)" -ForegroundColor Green

Write-Host "`nValidation passed!" -ForegroundColor Green

# Cleanup
Remove-Item $outputPath -Recurse -Force
foreach ($stub in $createdStubs) { Remove-Item $stub -Force }
Write-Host "Cleanup complete." -ForegroundColor DarkGray
