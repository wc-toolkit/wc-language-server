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

# Step 1: Restore and build the project, explicitly invoking CreateVsixContainer.
# With SDK-style projects (Sdk="Microsoft.NET.Sdk") the VSSDK CreateVsixContainer
# target does not auto-hook into the default Build pipeline — it must be called
# explicitly.
Write-Host "`nStep 1: Building project..."
msbuild $projectFile /t:Restore /p:Configuration=$Configuration /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild restore failed" }

msbuild $projectFile `
    "/t:Build;CreateVsixContainer" `
    /p:Configuration=$Configuration `
    /p:DeployExtension=false `
    /p:CreateVsixContainer=true `
    /v:minimal | Out-Host
if ($LASTEXITCODE -ne 0) { throw "msbuild build failed" }

# Step 2: Find the VSSDK-generated VSIX
Write-Host "`nStep 2: Locating VSSDK-generated VSIX..."
# VSSDK may place the .vsix in bin\Release, bin\Release\net472, or even the project dir
$searchPaths = @(
    (Join-Path $projectDir "bin\$Configuration"),
    $projectDir
)
$generatedVsix = $null
foreach ($searchPath in $searchPaths) {
    if (Test-Path $searchPath) {
        $generatedVsix = Get-ChildItem -Path $searchPath -Filter "*.vsix" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($generatedVsix) { break }
    }
}

if (-not $generatedVsix) {
    Write-Host "Directory listing for diagnostics:"
    Get-ChildItem -Path (Join-Path $projectDir "bin") -Recurse -File -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Host "  $($_.FullName)  ($($_.Length) bytes)" }
    throw "VSSDK did not produce a .vsix file. Check build output above for VSIX-related warnings."
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

# Step 4: Validate and fix-up VSIX for marketplace compliance (VSIX v3)
Write-Host "`nStep 4: Validating VSIX for marketplace compliance..."
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$vsixPath = $generatedVsix.FullName

# Open the VSIX and inspect contents
$zip = [System.IO.Compression.ZipFile]::Open($vsixPath, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    Write-Host "VSIX entries:"
    foreach ($entry in $zip.Entries) {
        Write-Host "  $($entry.FullName)  ($($entry.Length) bytes)"
    }

    # Check extension.vsixmanifest for unresolved template variables
    $vsixManifestEntry = $zip.GetEntry("extension.vsixmanifest")
    if (-not $vsixManifestEntry) { throw "VSIX is missing extension.vsixmanifest" }
    
    $reader = New-Object System.IO.StreamReader($vsixManifestEntry.Open())
    $vsixManifestContent = $reader.ReadToEnd()
    $reader.Dispose()
    Write-Host "`nextension.vsixmanifest content:"
    Write-Host $vsixManifestContent

    if ($vsixManifestContent -match '\|%') {
        Write-Warning "extension.vsixmanifest contains unresolved MSBuild template variables!"
        Write-Warning "This would cause marketplace rejection. The VSSDK did not resolve templates properly."
    }

    # Check for VSIX v3 metadata
    $hasCatalog = $null -ne $zip.GetEntry("catalog.json")
    $hasManifestJson = $null -ne $zip.GetEntry("manifest.json")
    
    Write-Host "`nVSIX v3 status: catalog.json=$hasCatalog, manifest.json=$hasManifestJson"

    if (-not $hasCatalog -or -not $hasManifestJson) {
        Write-Host "VSIX v3 metadata missing - generating..."

        # Gather all files for catalog
        $allEntries = @()
        foreach ($entry in $zip.Entries) {
            $allEntries += @{
                FullName = $entry.FullName
                Length = $entry.Length
            }
        }

        if (-not $hasCatalog) {
            $fileEntries = $allEntries | ForEach-Object {
                [ordered]@{ fileName = "/$($_.FullName.Replace('\','/'))" }
            }
            $catalogObj = [ordered]@{
                manifestVersion = '1.1'
                info = [ordered]@{
                    id = "$id,version=$version"
                    manifestType = 'Extension'
                }
                packages = @([ordered]@{
                    id = $id
                    version = $version
                    type = 'Vsix'
                    extensionDir = '[installdir]'
                    files = @($fileEntries)
                    dependencies = [ordered]@{}
                    msiProperties = [ordered]@{}
                })
            }
            $catalogJson = $catalogObj | ConvertTo-Json -Depth 10
            $catalogEntry = $zip.CreateEntry("catalog.json")
            $writer = New-Object System.IO.StreamWriter($catalogEntry.Open())
            $writer.Write($catalogJson)
            $writer.Dispose()
            Write-Host "Added catalog.json"
        }

        if (-not $hasManifestJson) {
            $totalSize = ($allEntries | Measure-Object -Property Length -Sum).Sum
            $manifestObj = [ordered]@{
                id = $id
                version = $version
                type = 'Vsix'
                vsixId = $id
                displayName = 'Web Components Language Server'
                description = 'Language Server Protocol integration for Web Components and Custom Elements in Visual Studio.'
                installSizes = [ordered]@{
                    targetDrive = [int]$totalSize
                }
            }
            $manifestJson = $manifestObj | ConvertTo-Json -Depth 5
            $manifestEntry = $zip.CreateEntry("manifest.json")
            $writer = New-Object System.IO.StreamWriter($manifestEntry.Open())
            $writer.Write($manifestJson)
            $writer.Dispose()
            Write-Host "Added manifest.json"
        }
    } else {
        # Dump existing v3 metadata for diagnostics
        foreach ($name in @('catalog.json', 'manifest.json')) {
            $entry = $zip.GetEntry($name)
            $reader = New-Object System.IO.StreamReader($entry.Open())
            $content = $reader.ReadToEnd()
            $reader.Dispose()
            Write-Host "`n${name}:"
            Write-Host $content
        }
    }
}
finally {
    $zip.Dispose()
}

# Step 5: Copy to output path with the desired name
Write-Host "`nStep 5: Copying VSIX to output..."
$outputVsixPath = Join-Path $OutputPath $vsixFileName
Copy-Item $vsixPath $outputVsixPath -Force

Write-Host "`nVSIX ready!"
Write-Host "Path: $outputVsixPath"
Write-Host "Size: $((Get-Item $outputVsixPath).Length) bytes"
return $outputVsixPath
