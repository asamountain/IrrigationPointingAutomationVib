#!/usr/bin/env pwsh
# Quick Git Push Script
# Usage: .\git-push.ps1 "Your commit message"

param(
    [string]$message = "Update: Report History Panel + Enforced Manager Switching"
)

Write-Host "📦 Git Push Helper" -ForegroundColor Cyan
Write-Host "==================`n" -ForegroundColor Cyan

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not in a git repository!" -ForegroundColor Red
    exit 1
}

# Show status
Write-Host "📊 Current Status:" -ForegroundColor Yellow
git status --short

Write-Host "`n📝 Staging all changes..." -ForegroundColor Yellow
git add .

Write-Host "💾 Committing with message:" -ForegroundColor Yellow
Write-Host "   `"$message`"`n" -ForegroundColor White
git commit -m "$message"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n⚠️  Nothing to commit or commit failed" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🚀 Pushing to origin main..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Push failed!" -ForegroundColor Red
    Write-Host "`nℹ️  If authentication failed:" -ForegroundColor Yellow
    Write-Host "   1. Go to https://github.com/settings/tokens" -ForegroundColor White
    Write-Host "   2. Generate new token (classic) with 'repo' scope" -ForegroundColor White
    Write-Host "   3. Use token as password when prompted" -ForegroundColor White
    Write-Host "   4. Run: git config --global credential.helper wincred" -ForegroundColor White
    exit 1
}
