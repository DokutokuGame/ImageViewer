$ErrorActionPreference = 'Stop'

$repository = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $repository 'package.json') -Raw | ConvertFrom-Json
$archive = Join-Path $repository "dist/ImageViewer-$($manifest.version)-win-x64.zip"
$checksumFile = "$archive.sha256"
$installRoot = Join-Path $env:RUNNER_TEMP "ImageViewer-clean-$($manifest.version)"

if (-not (Test-Path $archive) -or -not (Test-Path $checksumFile)) {
  throw '构建产物或 SHA-256 文件不存在。请先运行 npm run build:windows。'
}

$expected = ((Get-Content $checksumFile -Raw).Trim() -split '\s+')[0]
$actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "SHA-256 不匹配：期望 $expected，实际 $actual" }

Remove-Item $installRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item $installRoot -ItemType Directory | Out-Null
Expand-Archive $archive -DestinationPath $installRoot
$executable = Get-ChildItem $installRoot -Filter ImageViewer.exe -Recurse | Select-Object -First 1
if (-not $executable) { throw '解压安装后未找到 ImageViewer.exe。' }
$installedManifest = Get-ChildItem $installRoot -Filter package.json -Recurse |
  Where-Object { $_.FullName -match 'resources\\app\\package.json$' } | Select-Object -First 1
if (-not $installedManifest) { throw '安装目录中未找到应用清单。' }
$installedVersion = (Get-Content $installedManifest.FullName -Raw | ConvertFrom-Json).version
if ($installedVersion -ne $manifest.version) {
  throw "安装包版本不匹配：期望 $($manifest.version)，实际 $installedVersion"
}
Write-Host "干净目录安装验证通过：$($executable.FullName)，版本 $installedVersion，SHA-256 $actual"
Remove-Item $installRoot -Recurse -Force
