$ErrorActionPreference = "Stop"

$appDir = $PSScriptRoot
$envExample = Join-Path $appDir ".env.local.example"
$envLocal = Join-Path $appDir ".env.local"

if (-not (Test-Path -LiteralPath $envLocal) -and (Test-Path -LiteralPath $envExample)) {
    Copy-Item -LiteralPath $envExample -Destination $envLocal
    Write-Host ".env.local created from .env.local.example"
}

Set-Location $appDir
npm run dev
