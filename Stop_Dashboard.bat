@echo off
title Stop Automation Dashboard
echo ==============================================
echo    Dang dung Automation Dashboard...
echo ==============================================
echo.

:: Dung server qua stop-server.js
node dashboard/stop-server.js

echo.
echo Hoan tat! Tien trinh Dashboard cua thu muc nay da duoc dung.
timeout /t 2 > nul
exit /b 0
