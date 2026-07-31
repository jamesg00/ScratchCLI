[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifest = Join-Path $repoRoot "Package.appxmanifest"
$exe = Join-Path $repoRoot "src-tauri\target\release\scratchcli.exe"
$assets = Join-Path $repoRoot "Assets"
$layout = Join-Path $repoRoot "msix-dist"
$release = Join-Path $repoRoot "release"

if (!(Test-Path -LiteralPath $manifest)) { throw "Missing package manifest: $manifest" }
if (!(Test-Path -LiteralPath $exe)) { throw "Missing release executable: $exe. Run the Tauri build first." }
if (!(Test-Path -LiteralPath $assets)) { throw "Missing Store assets: $assets" }

[xml]$manifestXml = Get-Content -LiteralPath $manifest
$version = $manifestXml.Package.Identity.Version
if (!$version) { throw "The MSIX manifest does not contain an Identity Version." }

$sdkRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
$makeAppx = Get-ChildItem -Path $sdkRoot -Recurse -Filter "makeappx.exe" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match "\\x64\\makeappx\.exe$" } |
  Sort-Object FullName -Descending |
  Select-Object -First 1
if (!$makeAppx) {
  throw "MakeAppx.exe was not found. Install the Windows 10/11 SDK, then run this command again."
}

# The layout is generated output only. Keeping it clean prevents stale or nested
# assets from being included in a Store submission.
$resolvedLayout = [IO.Path]::GetFullPath($layout)
if (!$resolvedLayout.StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean a package layout outside this repository: $resolvedLayout"
}
if (Test-Path -LiteralPath $layout) { Remove-Item -LiteralPath $layout -Recurse -Force }
New-Item -ItemType Directory -Path $layout -Force | Out-Null
New-Item -ItemType Directory -Path $release -Force | Out-Null

Copy-Item -LiteralPath $exe -Destination (Join-Path $layout "scratchcli.exe") -Force
Copy-Item -LiteralPath $manifest -Destination (Join-Path $layout "AppxManifest.xml") -Force
Copy-Item -LiteralPath $assets -Destination (Join-Path $layout "Assets") -Recurse -Force

$output = Join-Path $release "ScratchCLI_$version`_x64.msix"
& $makeAppx.FullName pack /d $layout /p $output /o
if ($LASTEXITCODE -ne 0) { throw "MakeAppx failed while creating the MSIX." }

Write-Host "MSIX created: $output"
