$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$python = Join-Path $repoRoot ".venv\Scripts\python.exe"
$frontendPackage = Join-Path $repoRoot "frontend\package.json"
$backendTests = Join-Path $repoRoot "backend\tests"
$backendDir = Join-Path $repoRoot "backend"
$pytestBaseTemp = Join-Path $repoRoot ".tmp\pytest"

function Assert-PathExists {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,
        [Parameter(Mandatory = $true)]
        [string] $Description
    )

    if (-not (Test-Path $Path)) {
        throw "Falta $Description en: $Path"
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [string] $Command,
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    Write-Host ""
    Write-Host "== $Name =="
    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$Name fallo con codigo de salida $LASTEXITCODE."
    }
}

Assert-PathExists -Path $python -Description "el Python local .venv\Scripts\python.exe"
Assert-PathExists -Path $frontendPackage -Description "frontend/package.json"
Assert-PathExists -Path $backendTests -Description "backend/tests"

New-Item -ItemType Directory -Force -Path (Split-Path $pytestBaseTemp) | Out-Null

$previousPythonPath = $env:PYTHONPATH
$env:PYTHONPATH = $backendDir

Push-Location $repoRoot
try {
    Invoke-Checked `
        -Name "Backend pytest" `
        -Command $python `
        -Arguments @(
            "-m",
            "pytest",
            "-q",
            "--disable-warnings",
            "-x",
            "backend\tests",
            "--basetemp",
            $pytestBaseTemp
        )

    Invoke-Checked `
        -Name "Frontend tests" `
        -Command "npm.cmd" `
        -Arguments @("run", "test", "--prefix", "frontend")

    Invoke-Checked `
        -Name "Frontend lint" `
        -Command "npm.cmd" `
        -Arguments @("run", "lint", "--prefix", "frontend")

    Invoke-Checked `
        -Name "Frontend build" `
        -Command "npm.cmd" `
        -Arguments @("run", "build", "--prefix", "frontend")

    Write-Host ""
    Write-Host "Validacion local completada correctamente."
}
finally {
    if ($null -eq $previousPythonPath) {
        Remove-Item Env:\PYTHONPATH -ErrorAction SilentlyContinue
    }
    else {
        $env:PYTHONPATH = $previousPythonPath
    }

    Pop-Location
}
