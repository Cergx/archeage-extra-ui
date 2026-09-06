$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$browserRoot = Join-Path $projectRoot 'tools\chromeForTesting'
$chromePath = Join-Path $browserRoot 'chrome-win64\chrome.exe'

if (Test-Path -LiteralPath $chromePath) {
    Write-Host "[chromeForTesting] Already installed: $chromePath"
    exit 0
}

$metadata = Invoke-RestMethod 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json'
$download = $metadata.channels.Stable.downloads.chrome |
    Where-Object { $_.platform -eq 'win64' } |
    Select-Object -First 1

if (-not $download) {
    throw 'The stable win64 Chrome for Testing download was not found.'
}

New-Item -ItemType Directory -Force -Path $browserRoot | Out-Null
$archivePath = Join-Path $env:TEMP "chromeForTesting-$($metadata.channels.Stable.version)-win64-$([guid]::NewGuid().ToString('N')).zip"

try {
    Write-Host "[chromeForTesting] Downloading $($metadata.channels.Stable.version)..."
    & curl.exe --fail --location --retry 3 --connect-timeout 20 --output $archivePath $download.url
    if ($LASTEXITCODE -ne 0) {
        throw "Chrome for Testing download failed with exit code $LASTEXITCODE."
    }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $browserRoot -Force
} finally {
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
}

if (-not (Test-Path -LiteralPath $chromePath)) {
    throw "Chrome for Testing was not extracted to $chromePath"
}

Write-Host "[chromeForTesting] Installed: $chromePath"
