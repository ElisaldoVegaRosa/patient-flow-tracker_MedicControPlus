param(
    [ValidateSet("Start", "Stop", "Status")]
    [string] $Action = "Status",
    [string] $Database,
    [string] $LanConfig
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$demoPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $demoPython)) {
    throw "Falta .venv\Scripts\python.exe. Consulta docs/DEMO_OPERATIONS.md."
}
$demoArguments = @((Join-Path $PSScriptRoot "demo_control.py"), $Action.ToLowerInvariant())
if ($Database) { $demoArguments += @("--database", $Database) }
if ($LanConfig) { $demoArguments += @("--lan-config", $LanConfig) }
& $demoPython @demoArguments
exit $LASTEXITCODE
