@echo off
setlocal enabledelayedexpansion
title QA Automation Studio
echo ========================================================
echo    Dang khoi dong QA Automation Studio...
echo ========================================================
echo.

:: 1. Kiem tra neu lan dau mo thi cai dat moi truong
if not exist "node_modules" (
    echo Lan dau su dung, dang thiet lap moi truong...
    call npm install --prefer-offline
    echo.
)

:: 2. Khoi dong Dashboard Server chay ngam
if exist "dashboard\start-server.js" (
    node dashboard\start-server.js
) else if exist "node_modules\@hadinhkms\qa-automation-engine\dashboard\start-server.js" (
    node node_modules\@hadinhkms\qa-automation-engine\dashboard\start-server.js
) else (
    start /b npx qa-dashboard
)

:: 3. Doc port thuc te tu .dashboard-server.json
if exist ".dashboard-server.json" (
    for /f "tokens=2 delims=:, " %%a in ('findstr "port" .dashboard-server.json') do (
        set PORT=%%a
    )
)
if not defined PORT set PORT=4174

:: 4. Tu dong mo trinh duyet
echo.
echo [OK] Dang mo trinh duyet tai http://127.0.0.1:%PORT%/ ...
start http://127.0.0.1:%PORT%/

echo.
echo Hoan tat! Cua so nay se tu dong dong.
timeout /t 2 > nul
exit /b 0
