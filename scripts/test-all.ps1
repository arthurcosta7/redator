param(
    [switch]$SkipE2E
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPython = Join-Path $projectRoot "backend\.venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $backendPython)) {
    throw "Virtualenv do backend não encontrado. Consulte docs/DEVELOPMENT.md."
}

Push-Location (Join-Path $projectRoot "backend")
try {
    & $backendPython -m pytest
    if ($LASTEXITCODE -ne 0) { throw "Testes do backend falharam." }
} finally {
    Pop-Location
}

Push-Location (Join-Path $projectRoot "frontend")
try {
    npm run type-check
    if ($LASTEXITCODE -ne 0) { throw "Type-check do frontend falhou." }

    npm run test:coverage
    if ($LASTEXITCODE -ne 0) { throw "Testes unitários do frontend falharam." }

    if (-not $SkipE2E) {
        npm run test:e2e
        if ($LASTEXITCODE -ne 0) { throw "Testes E2E falharam." }
    }
} finally {
    Pop-Location
}

Write-Host "Todas as verificações automatizadas foram aprovadas."
