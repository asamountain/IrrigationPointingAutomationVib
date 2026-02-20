@echo off
REM Quick Git Pull Script

echo.
echo ====================================
echo    Git Pull Helper
echo ====================================
echo.

REM Check if we're in a git repository
if not exist ".git" (
    echo [ERROR] Not in a git repository!
    pause
    exit /b 1
)

echo [PULL] Pulling updates from origin main...
git pull origin main

if errorlevel 1 (
    echo.
    echo [ERROR] Pull failed!
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Successfully updated!
echo.
pause
