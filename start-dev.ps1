$ErrorActionPreference = "Stop"

$appDir = $PSScriptRoot
$envExample = Join-Path $appDir ".env.example"
$envLocal = Join-Path $appDir ".env.local"

if (-not (Test-Path -LiteralPath $envExample -PathType Leaf)) {
    throw "Missing environment template: $envExample"
}

if (-not (Test-Path -LiteralPath $envLocal -PathType Leaf)) {
    $copyCommand = 'Copy-Item -LiteralPath "{0}" -Destination "{1}"' -f $envExample, $envLocal
    throw "Missing local environment file: $envLocal`nCreate it with:`n$copyCommand"
}

Push-Location -LiteralPath $appDir

try {
    & npm run dev
}
finally {
    Pop-Location
}
