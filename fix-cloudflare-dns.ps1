# Cloudflare DNS Record Conflict Fix Script
# This script helps you identify and fix DNS record conflicts

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Cloudflare DNS Conflict Fix Guide" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Step 1: Check your Cloudflare Tunnel" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Gray
Write-Host "Run this command to see your tunnel details:"
Write-Host "  cloudflared tunnel list" -ForegroundColor Green

Write-Host ""
Write-Host "Step 2: Check DNS records for conflicts" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Log in to Cloudflare Dashboard:" -ForegroundColor White
Write-Host "  1. Go to: https://dash.cloudflare.com" -ForegroundColor Cyan
Write-Host "  2. Select your domain: hadibookstore.shop" -ForegroundColor Cyan
Write-Host "  3. Click: DNS -> Records" -ForegroundColor Cyan
Write-Host "  4. Look for existing records with hostname 'api' or your subdomain" -ForegroundColor Cyan

Write-Host ""
Write-Host "Step 3: Delete conflicting records" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Gray
Write-Host "For each conflicting record (A, AAAA, or CNAME):" -ForegroundColor White
Write-Host "  - Click the Delete button" -ForegroundColor Cyan
Write-Host "  - Confirm deletion" -ForegroundColor Cyan

Write-Host ""
Write-Host "Step 4: Add tunnel route again" -ForegroundColor Yellow
Write-Host "-------------------------------" -ForegroundColor Gray
Write-Host "In Cloudflare Zero Trust Dashboard:" -ForegroundColor White
Write-Host "  1. Go to: https://one.dash.cloudflare.com" -ForegroundColor Cyan
Write-Host "  2. Navigate to: Access -> Tunnels" -ForegroundColor Cyan
Write-Host "  3. Click on: hadi-books-api-tunnel" -ForegroundColor Cyan
Write-Host "  4. Click: Configure -> Public Hostname" -ForegroundColor Cyan
Write-Host "  5. Add your route:" -ForegroundColor Cyan
Write-Host "     - Subdomain: api" -ForegroundColor Green
Write-Host "     - Domain: hadibookstore.shop" -ForegroundColor Green
Write-Host "     - Service: http://localhost:4000" -ForegroundColor Green

Write-Host ""
Write-Host "Alternative: Skip DNS record creation" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Gray
Write-Host "If you want to keep the existing DNS record:" -ForegroundColor White
Write-Host "  1. When adding the tunnel route, check the box:" -ForegroundColor Cyan
Write-Host "     'Skip DNS record creation' or 'DNS record already exists'" -ForegroundColor Cyan
Write-Host "  2. Manually update your existing DNS record:" -ForegroundColor Cyan
Write-Host "     - Type: CNAME" -ForegroundColor Green
Write-Host "     - Name: api" -ForegroundColor Green
Write-Host "     - Content: [tunnel-id].cfargotunnel.com" -ForegroundColor Green
Write-Host "     - Proxy status: Proxied (orange cloud)" -ForegroundColor Green

Write-Host ""
Write-Host "Need to find your tunnel ID?" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Gray
Write-Host "Run: cloudflared tunnel list" -ForegroundColor Green
Write-Host "Look for: hadi-books-api-tunnel" -ForegroundColor Cyan

Write-Host ""
Write-Host "After fixing, test your API:" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Gray
Write-Host "  curl https://api.hadibookstore.shop/health" -ForegroundColor Green

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
