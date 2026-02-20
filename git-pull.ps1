#!/usr/bin/env pwsh
# Quick Git Pull Script

Write-Host "📦 Git Pull Helper" -ForegroundColor Cyan
Write-Host "==================`n" -ForegroundColor Cyan

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not in a git repository!" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 Pulling updates from origin main..." -ForegroundColor Yellow
git pull origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully updated!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Pull failed!" -ForegroundColor Red
    exit 1
}
