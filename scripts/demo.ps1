param(
    [ValidateSet("Start", "Stop", "Status")]
    [string] $Action = "Status"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$demoPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $demoPython)) {
    throw "Falta .venv\Scripts\python.exe. Consulta docs/DEMO_OPERATIONS.md."
}
& $demoPython (Join-Path $PSScriptRoot "demo_control.py") $Action.ToLowerInvariant()
exit $LASTEXITCODE
