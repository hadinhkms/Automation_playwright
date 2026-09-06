@echo off
title Stop QA Studio
echo ========================================================
echo    Dang dung QA Automation Studio...
echo ========================================================
echo.

if exist "dashboard\stop-server.js" (
    node dashboard\stop-server.js
) else if exist "node_modules\@hadinhkms\qa-automation-engine\dashboard\stop-server.js" (
    node node_modules\@hadinhkms\qa-automation-engine\dashboard\stop-server.js
)

echo.
echo [OK] Da dung tien trinh Dashboard thanh cong!
timeout /t 2 > nul
exit /b 0
