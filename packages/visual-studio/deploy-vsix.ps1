$ErrorActionPreference = "Stop"

if ($IsLinux -or $IsMacOS) {
  Write-Error "deploy-vsix.ps1 requires Windows with Visual Studio installed."
  exit 1
}

if (-not (Get-Command msbuild -ErrorAction SilentlyContinue)) {
  Write-Error "msbuild not found. Run from a Visual Studio Developer PowerShell."
  exit 1
}

$outputPath = Join-Path $PSScriptRoot "..\..\local-vsix-output"
$binPath = Join-Path $PSScriptRoot "..\language-server\bin"

# Create stub binaries if not present so the build doesn't fail locally
$stubs = @("wc-language-server.js", "wc-language-server-windows-x64.exe")
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

# Build the VSIX
Write-Host "Building VSIX..." -ForegroundColor Cyan
$vsixPath = ./build-vsix.ps1 -OutputPath $outputPath -Configuration Release
$vsixPath = (Resolve-Path $vsixPath).Path

# Find VSIXInstaller.exe
Write-Host "`nLocating VSIXInstaller..." -ForegroundColor Cyan
$installer = Get-ChildItem "C:\Program Files\Microsoft Visual Studio" `
  -Recurse -Filter "VSIXInstaller.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $installer) {
  Write-Error "VSIXInstaller.exe not found. Ensure Visual Studio is installed."
  exit 1
}
Write-Host "Found: $($installer.FullName)"

# Check Visual Studio is not running
$vsProcesses = Get-Process -Name "devenv" -ErrorAction SilentlyContinue
if ($vsProcesses) {
  Write-Host "Visual Studio is running. Installing into the Experimental Instance instead..." -ForegroundColor Yellow
  & $installer.FullName /quiet /rootSuffix:Exp $vsixPath
} else {
  & $installer.FullName /quiet $vsixPath
}

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nInstalled successfully!" -ForegroundColor Green
} else {
  Write-Error "Installation failed with exit code: $LASTEXITCODE"
  exit 1
}

# Cleanup
Remove-Item $outputPath -Recurse -Force
foreach ($stub in $createdStubs) { Remove-Item $stub -Force }
Write-Host "Cleanup complete." -ForegroundColor DarkGray
