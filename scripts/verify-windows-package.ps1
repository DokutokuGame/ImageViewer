$ErrorActionPreference = 'Stop'

$repository = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $repository 'package.json') -Raw | ConvertFrom-Json
$archive = Join-Path $repository "dist/ImageViewer-$($manifest.version)-win-x64.zip"
$checksumFile = "$archive.sha256"
$installRoot = Join-Path $env:RUNNER_TEMP "ImageViewer-clean-$($manifest.version)"

if (-not (Test-Path $archive) -or -not (Test-Path $checksumFile)) {
  throw 'Package or SHA-256 file not found. Run npm run build:windows first.'
}

$expected = ((Get-Content $checksumFile -Raw).Trim() -split '\s+')[0]
$actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "SHA-256 mismatch: expected $expected, got $actual" }

Remove-Item $installRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item $installRoot -ItemType Directory | Out-Null
Expand-Archive $archive -DestinationPath $installRoot
$executable = Get-ChildItem $installRoot -Filter ImageViewer.exe -Recurse | Select-Object -First 1
if (-not $executable) { throw 'ImageViewer.exe was not found after clean extraction.' }
$installedManifest = Get-ChildItem $installRoot -Filter package.json -Recurse |
  Where-Object { $_.FullName -match 'resources\\app\\package.json$' } | Select-Object -First 1
if (-not $installedManifest) { throw 'Application manifest was not found in the extracted package.' }
$installedVersion = (Get-Content $installedManifest.FullName -Raw | ConvertFrom-Json).version
if ($installedVersion -ne $manifest.version) {
  throw "Package version mismatch: expected $($manifest.version), got $installedVersion"
}
Write-Host "Clean extraction verified: $($executable.FullName), version $installedVersion, SHA-256 $actual"
Remove-Item $installRoot -Recurse -Force
