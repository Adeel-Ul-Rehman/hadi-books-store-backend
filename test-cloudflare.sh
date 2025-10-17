#!/bin/bash
# Test script to verify Cloudflare vs Backend issue

echo "========================================="
echo "🔍 CLOUDFLARE vs BACKEND DIAGNOSTIC"
echo "========================================="
echo ""

echo "=== TEST 1: Direct Backend (Bypasses Cloudflare) ==="
echo "Testing: http://127.0.0.1:4000/api/checkout/calculate"
curl -s -X OPTIONS \
  -H "Origin: https://www.hadibookstore.shop" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://127.0.0.1:4000/api/checkout/calculate \
  -w "\nHTTP Status: %{http_code}\n" \
  -D - | grep -i "access-control"

echo ""
echo "=== TEST 2: Through Cloudflare Tunnel ==="
echo "Testing: https://api.hadibookstore.shop/api/checkout/calculate"
curl -s -X OPTIONS \
  -H "Origin: https://www.hadibookstore.shop" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://api.hadibookstore.shop/api/checkout/calculate \
  -w "\nHTTP Status: %{http_code}\n" \
  -D - | grep -i "access-control"

echo ""
echo "=== TEST 3: GET Request (Usually Works) ==="
echo "Testing: https://api.hadibookstore.shop/api/health"
curl -s -I -H "Origin: https://www.hadibookstore.shop" \
  https://api.hadibookstore.shop/api/health | grep -i "access-control"

echo ""
echo "========================================="
echo "📊 ANALYSIS"
echo "========================================="
echo ""
echo "If TEST 1 shows CORS headers but TEST 2 doesn't:"
echo "  → ✅ Backend is CORRECT"
echo "  → ❌ Cloudflare is BLOCKING/STRIPPING headers"
echo "  → 🔧 FIX: Adjust Cloudflare settings"
echo ""
echo "If both TEST 1 and TEST 2 show no CORS headers:"
echo "  → ❌ Backend code issue"
echo "  → 🔧 FIX: Check server.js CORS configuration"
echo ""
echo "If TEST 3 works but TEST 2 doesn't:"
echo "  → ❌ Cloudflare is blocking OPTIONS requests"
echo "  → 🔧 FIX: Disable Bot Fight Mode in Cloudflare"
echo ""
