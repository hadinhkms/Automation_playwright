[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Write-Host "=== Setting up Test Environment for QA Automation Engine ===" -ForegroundColor Cyan

# 1. Verify Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not in PATH."
    exit 1
}
$nodeVer = & node --version
Write-Host "Node.js version: $nodeVer"

# 2. Check dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies with npm ci..."
    & npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm ci failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} else {
    Write-Host "node_modules directory is present."
}

# 3. Ensure Playwright browsers are available
Write-Host "Ensuring Playwright Chromium browser is installed..."
& npx playwright install chromium
if ($LASTEXITCODE -ne 0) {
    Write-Warning "playwright install chromium returned exit code $LASTEXITCODE"
}

Write-Host "=== Setup completed successfully ===" -ForegroundColor Green
exit 0
