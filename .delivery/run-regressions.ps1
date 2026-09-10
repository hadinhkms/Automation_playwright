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

$tempDir = [System.IO.Path]::Combine($projectRoot, ".tmp-gate-runs")
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

$apiXmlPath = [System.IO.Path]::Combine($tempDir, "api-junit.xml")
$pwXmlPath = [System.IO.Path]::Combine($tempDir, "playwright-junit.xml")
if (Test-Path $apiXmlPath) { Remove-Item $apiXmlPath -Force }
if (Test-Path $pwXmlPath) { Remove-Item $pwXmlPath -Force }

try {
    Write-Host ">>> Running Dashboard API Contract Tests..." -ForegroundColor Cyan
    # Enumerate all API test files
    $apiFiles = Get-ChildItem -Path (Join-Path $projectRoot "tests/dashboard-api") -Filter "*.test.js" | Select-Object -ExpandProperty FullName
    $apiOutput = & node --test-reporter=junit --test @apiFiles 2>&1
    $apiExitCode = $LASTEXITCODE

    # Write api junit output
    $apiXmlContent = ($apiOutput | Out-String).Trim()
    # Find start of XML
    $xmlStartIdx = $apiXmlContent.IndexOf("<?xml")
    if ($xmlStartIdx -ge 0) {
        $apiXmlContent = $apiXmlContent.Substring($xmlStartIdx)
    }
    # Cut off trailing non-xml comment summaries if any that would break XML parser
    $lastCloseTag = $apiXmlContent.LastIndexOf("</testsuites>")
    if ($lastCloseTag -ge 0) {
        $apiXmlContent = $apiXmlContent.Substring(0, $lastCloseTag + 13)
    }
    [System.IO.File]::WriteAllText($apiXmlPath, $apiXmlContent, [System.Text.Encoding]::UTF8)

    if ($apiExitCode -ne 0) {
        Write-Error "API contract tests failed with exit code $apiExitCode"
        exit $apiExitCode
    }

    Write-Host ">>> Running Dashboard Playwright Tests..." -ForegroundColor Cyan
    $env:PLAYWRIGHT_JUNIT_OUTPUT_NAME = $pwXmlPath
    & npx playwright test --config=playwright.dashboard.config.js --reporter=junit
    $pwExitCode = $LASTEXITCODE

    if ($pwExitCode -ne 0) {
        Write-Error "Playwright tests failed with exit code $pwExitCode"
        exit $pwExitCode
    }

    Write-Host ">>> Merging test reports into $junitResolved..." -ForegroundColor Cyan
    [xml]$apiDoc = Get-Content -Path $apiXmlPath -Raw -Encoding UTF8
    [xml]$pwDoc = Get-Content -Path $pwXmlPath -Raw -Encoding UTF8

    $mergedDoc = [xml]"<?xml version=`"1.0`" encoding=`"UTF-8`"?><testsuites></testsuites>"
    $rootNode = $mergedDoc.SelectSingleNode("/testsuites")

    # Import and append API test suites
    foreach ($suite in $apiDoc.SelectNodes("//testsuite")) {
        $importedNode = $mergedDoc.ImportNode($suite, $true)
        $rootNode.AppendChild($importedNode) | Out-Null
    }

    # Import and append Playwright test suites
    foreach ($suite in $pwDoc.SelectNodes("//testsuite")) {
        $importedNode = $mergedDoc.ImportNode($suite, $true)
        $rootNode.AppendChild($importedNode) | Out-Null
    }

    $mergedDoc.Save($junitResolved)
    Write-Host "Merged JUnit successfully written to $junitResolved" -ForegroundColor Green
    exit 0
} finally {
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
