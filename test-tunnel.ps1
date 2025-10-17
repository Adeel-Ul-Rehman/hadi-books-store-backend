# Test Cloudflare Tunnel Connection
# Run this after setting up your tunnel route

Write-Host "Testing Cloudflare Tunnel Setup..." -ForegroundColor Cyan
Write-Host "=" -NoNewline; Write-Host ("=" * 50) -ForegroundColor Gray

Write-Host ""
Write-Host "Step 1: Check if your local server is running" -ForegroundColor Yellow
Write-Host "Testing: http://localhost:4000/health" -ForegroundColor Gray

try {
    $localResponse = Invoke-WebRequest -Uri "http://localhost:4000/health" -Method Get -UseBasicParsing
    Write-Host "[OK] Local server is running!" -ForegroundColor Green
    Write-Host "     Status Code: $($localResponse.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Local server is NOT running!" -ForegroundColor Red
    Write-Host "        Please start your server first: npm start" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Step 2: Check DNS record" -ForegroundColor Yellow
Write-Host "Testing: nslookup api.hadibookstore.shop" -ForegroundColor Gray

try {
    $dnsResult = nslookup api.hadibookstore.shop 2>&1
    if ($dnsResult -match "cfargotunnel.com" -or $dnsResult -match "cloudflare") {
        Write-Host "[OK] DNS record is configured correctly!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] DNS might still be propagating..." -ForegroundColor Yellow
        Write-Host "          Wait 1-2 minutes and try again" -ForegroundColor Gray
    }
} catch {
    Write-Host "[ERROR] DNS lookup failed!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Step 3: Test public endpoint" -ForegroundColor Yellow
Write-Host "Testing: https://api.hadibookstore.shop/health" -ForegroundColor Gray

Start-Sleep -Seconds 2

try {
    $publicResponse = Invoke-WebRequest -Uri "https://api.hadibookstore.shop/health" -Method Get -UseBasicParsing
    Write-Host "[OK] Public endpoint is working!" -ForegroundColor Green
    Write-Host "     Status Code: $($publicResponse.StatusCode)" -ForegroundColor Gray
    Write-Host "     Your API is now live at: https://api.hadibookstore.shop" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Public endpoint failed!" -ForegroundColor Red
    Write-Host "        Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Check tunnel is running: cloudflared tunnel list" -ForegroundColor Gray
    Write-Host "  2. Verify route configuration in Cloudflare dashboard" -ForegroundColor Gray
    Write-Host "  3. Wait 1-2 minutes for DNS propagation" -ForegroundColor Gray
    Write-Host "  4. Check Cloudflare SSL/TLS mode is 'Full' or 'Full (strict)'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=" -NoNewline; Write-Host ("=" * 50) -ForegroundColor Gray
Write-Host "Testing complete!" -ForegroundColor Cyan
