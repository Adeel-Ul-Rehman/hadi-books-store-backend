# Deployment Script for DigitalOcean Droplet
# Run this on your DigitalOcean droplet via SSH

Write-Host "🔄 Starting deployment..." -ForegroundColor Cyan

# Navigate to server directory (adjust path if needed)
cd /root/books/server

Write-Host "📦 Installing dependencies (if needed)..." -ForegroundColor Yellow
npm install

Write-Host "🔄 Restarting PM2 process..." -ForegroundColor Yellow
pm2 restart all

Write-Host "⏳ Waiting for server to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "📊 Checking server status..." -ForegroundColor Yellow
pm2 status

Write-Host "`n📋 Recent server logs:" -ForegroundColor Yellow
pm2 logs server --lines 30 --nostream

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Test your site at: https://www.hadibookstore.shop" -ForegroundColor Cyan
Write-Host "🔍 Monitor logs with: pm2 logs server" -ForegroundColor Cyan
