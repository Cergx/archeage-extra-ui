$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectRoot 'dist\firefox'
$packagePath = Join-Path $projectRoot 'archeage-extra-ui-firefox.xpi'
$zipPath = Join-Path $projectRoot 'archeage-extra-ui-firefox.zip'

if (-not (Test-Path -LiteralPath (Join-Path $sourceDir 'manifest.json'))) {
    throw "Firefox build output was not found: $sourceDir"
}

Compress-Archive -Path (Join-Path $sourceDir '*') -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $packagePath -Force
Write-Output "[package:firefox] $packagePath"
