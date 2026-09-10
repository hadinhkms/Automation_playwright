[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$JunitPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$junitResolved = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $JunitPath))
$junitDir = Split-Path -Parent $junitResolved
if (-not (Test-Path $junitDir)) {
    New-Item -ItemType Directory -Path $junitDir -Force | Out-Null
}

$env:PLAYWRIGHT_JUNIT_OUTPUT_NAME = $junitResolved
& npx.cmd playwright test --config=playwright.dashboard.config.js tests/dashboard/templates-performance-a11y.spec.js --reporter=junit
exit $LASTEXITCODE
