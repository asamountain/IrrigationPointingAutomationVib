@echo off
REM Quick Git Push Script
REM Usage: git-push.bat "Your commit message"

setlocal enabledelayedexpansion

set "message=%~1"
if "%message%"=="" set "message=Update: Report History Panel + Enforced Manager Switching"

echo.
echo ====================================
echo    Git Push Helper
echo ====================================
echo.

REM Check if we're in a git repository
if not exist ".git" (
    echo [ERROR] Not in a git repository!
    exit /b 1
)

REM Show status
echo [STATUS] Current changes:
git status --short
echo.

REM Stage all changes
echo [STAGE] Adding all changes...
git add .
echo.

REM Commit
echo [COMMIT] Committing with message:
echo    "%message%"
git commit -m "%message%"
if errorlevel 1 (
    echo.
    echo [WARNING] Nothing to commit or commit failed
    exit /b 1
)
echo.

REM Push
echo [PUSH] Pushing to origin main...
git push origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed!
    echo.
    echo [INFO] If authentication failed:
    echo    1. Go to https://github.com/settings/tokens
    echo    2. Generate new token ^(classic^) with 'repo' scope
    echo    3. Use token as password when prompted
    echo    4. Run: git config --global credential.helper wincred
    exit /b 1
)

echo.
echo [SUCCESS] Successfully pushed to GitHub!
echo.
