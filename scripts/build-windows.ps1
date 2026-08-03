$ErrorActionPreference = 'Stop'

$repository = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $repository 'package.json') -Raw | ConvertFrom-Json
$version = $manifest.version
$architecture = 'x64'
$output = Join-Path $repository 'dist'
$staging = Join-Path $output "ImageViewer-$version-win-$architecture"
$electronDist = Join-Path $repository 'node_modules/electron/dist'

if (-not (Test-Path (Join-Path $electronDist 'electron.exe'))) {
  throw 'Windows Electron runtime not found. Run npm ci in a clean Windows x64 checkout first.'
}

Remove-Item $output -Recurse -Force -ErrorAction SilentlyContinue
New-Item $staging -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $electronDist '*') $staging -Recurse -Force
Rename-Item (Join-Path $staging 'electron.exe') 'ImageViewer.exe'

$resources = Join-Path $staging 'resources'
Remove-Item (Join-Path $resources 'default_app.asar') -Force -ErrorAction SilentlyContinue
$application = Join-Path $resources 'app'
New-Item $application -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $repository 'src') $application -Recurse
Copy-Item (Join-Path $repository 'renderer') $application -Recurse
@{
  name = $manifest.name
  productName = 'ImageViewer'
  version = $version
  main = $manifest.main
  private = $true
} | ConvertTo-Json | Set-Content (Join-Path $application 'package.json') -Encoding utf8

$archive = "$staging.zip"
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -CompressionLevel Optimal
$hash = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $(Split-Path $archive -Leaf)" | Set-Content "$archive.sha256" -Encoding ascii
Write-Host "Created $archive"
Write-Host "SHA-256: $hash"
