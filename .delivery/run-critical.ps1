[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$JunitPath,
    [string]$Specs = 'tests/dashboard/smoke.spec.js tests/dashboard/css-parity.spec.js tests/dashboard/foundation-parity.spec.js'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$junitResolved = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $JunitPath))
$junitDir = Split-Path -Parent $junitResolved
if (-not (Test-Path $junitDir)) {
    New-Item -ItemType Directory -Path $junitDir -Force | Out-Null
}

$env:PLAYWRIGHT_JUNIT_OUTPUT_NAME = $junitResolved
$specList = $Specs -split ' '
& npx.cmd playwright test --config=playwright.dashboard.config.js @specList --reporter=junit
exit $LASTEXITCODE
