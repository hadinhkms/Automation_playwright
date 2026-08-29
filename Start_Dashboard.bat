@echo off
setlocal enabledelayedexpansion
title Automation Dashboard
echo ==============================================
echo    Khoi dong Automation Dashboard...
echo ==============================================
echo.

:: Khoi dong Dashboard Server
node dashboard/start-server.js

:: Doc port thuc te tu file .dashboard-server.json
if exist ".dashboard-server.json" (
    for /f "tokens=2 delims=:, " %%a in ('findstr "port" .dashboard-server.json') do (
        set PORT=%%a
    )
)

if not defined PORT set PORT=4174

echo.
echo Mo trinh duyet tai http://127.0.0.1:%PORT%/ ...
start http://127.0.0.1:%PORT%/

echo.
echo Hoan tat! Ban co the dong cua so nay.
timeout /t 2 > nul
exit /b 0
