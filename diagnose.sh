#!/bin/bash
# Complete System Diagnostic Script
# Run this on your DigitalOcean droplet

echo "======================================"
echo "🔍 HADI BOOKS STORE - SYSTEM DIAGNOSTIC"
echo "======================================"
echo ""

echo "=== 1. PM2 PROCESS STATUS ==="
pm2 status
echo ""

echo "=== 2. PORT 4000 CHECK ==="
ss -tulpn | grep 4000
echo ""

echo "=== 3. BACKEND LOCAL TEST ==="
echo "Testing: http://127.0.0.1:4000/api/health"
curl -s http://127.0.0.1:4000/api/health
echo ""
echo ""

echo "=== 4. CLOUDFLARED STATUS ==="
sudo systemctl status cloudflared --no-pager | head -15
echo ""

echo "=== 5. CLOUDFLARED CONFIG ==="
if [ -f "/etc/cloudflared/config.yml" ]; then
    echo "Config file: /etc/cloudflared/config.yml"
    cat /etc/cloudflared/config.yml
else
    echo "⚠️  Config not found at /etc/cloudflared/config.yml"
fi
echo ""

echo "=== 6. PUBLIC API HEALTH TEST ==="
echo "Testing: https://api.hadibookstore.shop/api/health"
curl -s https://api.hadibookstore.shop/api/health
echo ""
echo ""

echo "=== 7. CORS PREFLIGHT TEST (OPTIONS) ==="
echo "Testing: OPTIONS https://api.hadibookstore.shop/api/orders/guest-create"
curl -s -I -X OPTIONS \
  -H "Origin: https://www.hadibookstore.shop" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://api.hadibookstore.shop/api/orders/guest-create | grep -i "access-control"
echo ""

echo "=== 8. ACTUAL POST REQUEST TEST ==="
echo "Testing: POST https://api.hadibookstore.shop/api/orders/guest-create"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Origin: https://www.hadibookstore.shop" \
  -H "Content-Type: application/json" \
  https://api.hadibookstore.shop/api/orders/guest-create \
  -d '{"guestName":"Test","guestEmail":"test@test.com","shippingAddress":"Test","items":[{"productId":"test","quantity":1,"price":100}],"totalPrice":100}')
echo "$RESPONSE"
echo ""

echo "=== 9. RECENT PM2 LOGS (ERRORS) ==="
pm2 logs hadi-books-store --err --lines 10 --nostream
echo ""

echo "=== 10. GIT VERSION CHECK ==="
cd ~/hadi-books-store-backend
echo "Current commit:"
git log --oneline -1
echo ""
echo "Checking for CORS fix in code:"
if grep -q "addCorsHeaders" controllers/guestOrderController.js; then
    echo "✅ CORS fix found in guestOrderController.js"
else
    echo "❌ CORS fix NOT found in guestOrderController.js"
fi
if grep -q "404 handler with CORS" server.js; then
    echo "✅ CORS fix found in server.js"
else
    echo "❌ CORS fix NOT found in server.js"
fi
echo ""

echo "======================================"
echo "✅ DIAGNOSTIC COMPLETE"
echo "======================================"
echo ""
echo "📋 ANALYSIS:"
echo "1. If local (127.0.0.1) works but public doesn't → Cloudflare issue"
echo "2. If you see CORS headers in OPTIONS → Backend is correct"
echo "3. If PM2 shows 'online' but port 4000 is empty → Server crashed"
echo "4. If cloudflared is 'inactive' → Tunnel is down"
echo ""
