@echo off
title Khoi Phuc Du Lieu Vieclam24h
echo ========================================================
echo    Dang khoi phuc du lieu Vieclam24h tu backup...
echo ========================================================
echo.

cd /d "%~dp0\.."

robocopy "_backup_vieclam24h\pages" "pages" /E /IS /IT > nul
robocopy "_backup_vieclam24h\data" "data" /E /IS /IT > nul
robocopy "_backup_vieclam24h\core" "core" /E /IS /IT > nul
robocopy "_backup_vieclam24h\tests" "tests" /E /IS /IT > nul
robocopy "_backup_vieclam24h\_Plan_implement" "_Plan_implement" /E /IS /IT > nul

copy /y "_backup_vieclam24h\dashboardConfig.json" "dashboardConfig.json" > nul
copy /y "_backup_vieclam24h\dashboardConfig.json" "core\config\dashboardConfig.json" > nul

if not exist ".env" (
    copy /y ".env.example" ".env" > nul
)

del /f /q "tests\e2e\desktop\sample_demo.spec.js" 2>nul
del /f /q "tests\e2e\mobile-web\sample_mobile.spec.js" 2>nul
del /f /q "tests\api\sample_api.spec.js" 2>nul
del /f /q "pages\desktop\SamplePage.js" 2>nul
del /f /q "data\sampleData.json" 2>nul

echo [OK] Da khoi phuc toan bo Page Objects, Data, Core Fixtures, Test Cases va Settings!
echo.
echo Dang khoi dong lai Dashboard...
node dashboard\stop-server.js > nul 2>&1
call Start_Dashboard.bat
