param([Parameter(Mandatory = $true)][string] $Address)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
& (Join-Path $repoRoot ".venv\Scripts\python.exe") (Join-Path $PSScriptRoot "prepare_demo_lan.py") --address $Address
exit $LASTEXITCODE
