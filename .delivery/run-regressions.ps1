[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$JunitPath,
    [string]$Phase = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$junitResolved = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $JunitPath))
$junitDir = Split-Path -Parent $junitResolved
if (-not (Test-Path $junitDir)) {
    New-Item -ItemType Directory -Path $junitDir -Force | Out-Null
}

if (-not $Phase) {
    $contractFile = Join-Path $projectRoot ".delivery/contract.json"
    if (Test-Path $contractFile) {
        try {
            $Phase = (Get-Content $contractFile -Raw | ConvertFrom-Json).phase
        } catch {}
    }
}

Write-Host "=== Running Regressions for Phase: [$Phase] ===" -ForegroundColor Cyan

if ($Phase -eq 'phase-00') {
    Write-Host ">>> Running Phase 0 Smoke & Coexistence Spike Tests..." -ForegroundColor Cyan
    $env:PLAYWRIGHT_JUNIT_OUTPUT_NAME = $junitResolved
    & npx.cmd playwright test --config=playwright.dashboard.config.js tests/dashboard/smoke.spec.js tests/dashboard/spike-esm-coexistence.spec.js --reporter=junit
    exit $LASTEXITCODE
}

if ($Phase -eq 'phase-01') {
    Write-Host ">>> Running Phase 1 API Contract Tests..." -ForegroundColor Cyan
    $apiFiles = Get-ChildItem -Path (Join-Path $projectRoot "tests/dashboard-api") -Filter "*.test.js" | Select-Object -ExpandProperty FullName
    $apiOutput = & node --test-reporter=junit --test @apiFiles 2>&1
    $apiExitCode = $LASTEXITCODE

    $apiXmlContent = ($apiOutput | Out-String).Trim()
    $xmlStartIdx = $apiXmlContent.IndexOf("<?xml")
    if ($xmlStartIdx -ge 0) { $apiXmlContent = $apiXmlContent.Substring($xmlStartIdx) }
    $lastCloseTag = $apiXmlContent.LastIndexOf("</testsuites>")
    if ($lastCloseTag -ge 0) { $apiXmlContent = $apiXmlContent.Substring(0, $lastCloseTag + 13) }
    [System.IO.File]::WriteAllText($junitResolved, $apiXmlContent, [System.Text.Encoding]::UTF8)

    if ($apiExitCode -ne 0) { exit $apiExitCode }
    Write-Host "API JUnit report successfully written to $junitResolved" -ForegroundColor Green
    exit 0
}

if ($Phase -eq 'phase-02') {
    Write-Host ">>> Running Phase 2 CSS Parity Tests..." -ForegroundColor Cyan
    $env:PLAYWRIGHT_JUNIT_OUTPUT_NAME = $junitResolved
    & npx.cmd playwright test --config=playwright.dashboard.config.js tests/dashboard/css-parity.spec.js --reporter=junit
    exit $LASTEXITCODE
}

# Default / Phase 3+: Run both API and Playwright tests, then merge
$tempDir = [System.IO.Path]::Combine($projectRoot, ".tmp-gate-runs")
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

$apiXmlPath = [System.IO.Path]::Combine($tempDir, "api-junit.xml")
$pwXmlPath = [System.IO.Path]::Combine($tempDir, "playwright-junit.xml")
if (Test-Path $apiXmlPath) { Remove-Item $apiXmlPath -Force }
if (Test-Path $pwXmlPath) { Remove-Item $pwXmlPath -Force }

try {
    Write-Host ">>> Running Dashboard API Contract Tests..." -ForegroundColor Cyan
    $apiFiles = Get-ChildItem -Path (Join-Path $projectRoot "tests/dashboard-api") -Filter "*.test.js" | Select-Object -ExpandProperty FullName
    $apiOutput = & node --test-reporter=junit --test @apiFiles 2>&1
    $apiExitCode = $LASTEXITCODE

    $apiXmlContent = ($apiOutput | Out-String).Trim()
    $xmlStartIdx = $apiXmlContent.IndexOf("<?xml")
    if ($xmlStartIdx -ge 0) { $apiXmlContent = $apiXmlContent.Substring($xmlStartIdx) }
    $lastCloseTag = $apiXmlContent.LastIndexOf("</testsuites>")
    if ($lastCloseTag -ge 0) { $apiXmlContent = $apiXmlContent.Substring(0, $lastCloseTag + 13) }
    [System.IO.File]::WriteAllText($apiXmlPath, $apiXmlContent, [System.Text.Encoding]::UTF8)

    if ($apiExitCode -ne 0) { exit $apiExitCode }

    Write-Host ">>> Running Dashboard Playwright Tests..." -ForegroundColor Cyan
    $env:PLAYWRIGHT_JUNIT_OUTPUT_NAME = $pwXmlPath
    & npx.cmd playwright test --config=playwright.dashboard.config.js --reporter=junit
    $pwExitCode = $LASTEXITCODE
    if ($pwExitCode -ne 0) { exit $pwExitCode }

    Write-Host ">>> Merging test reports into $junitResolved..." -ForegroundColor Cyan
    & python -c "
import xml.etree.ElementTree as ET
import sys

api_tree = ET.parse(sys.argv[1])
pw_tree = ET.parse(sys.argv[2])
root = ET.Element('testsuites')

for suite in api_tree.findall('.//testsuite'):
    root.append(suite)
for suite in pw_tree.findall('.//testsuite'):
    root.append(suite)

merged_tree = ET.ElementTree(root)
merged_tree.write(sys.argv[3], encoding='utf-8', xml_declaration=True)
" $apiXmlPath $pwXmlPath $junitResolved

    Write-Host "Merged JUnit successfully written to $junitResolved" -ForegroundColor Green
    exit 0
} finally {
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
