#!/bin/bash

echo "========================================="
echo "EMAIL CONFIGURATION TEST"
echo "========================================="
echo ""

# Test 1: Check if SMTP port is reachable
echo "TEST 1: Testing SMTP Port Connectivity"
echo "---------------------------------------"

echo "Testing port 465 (SSL)..."
timeout 5 bash -c "</dev/tcp/smtp.gmail.com/465" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Port 465 is OPEN and reachable"
else
  echo "❌ Port 465 is BLOCKED or unreachable"
fi

echo ""
echo "Testing port 587 (TLS)..."
timeout 5 bash -c "</dev/tcp/smtp.gmail.com/587" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Port 587 is OPEN and reachable"
else
  echo "❌ Port 587 is BLOCKED or unreachable"
fi

echo ""
echo "========================================="
echo "DEPLOYMENT INSTRUCTIONS"
echo "========================================="
echo ""
echo "Run these commands to update your backend:"
echo ""
echo "1. Pull latest code:"
echo "   cd ~/hadi-books-store-backend"
echo "   git pull origin main"
echo ""
echo "2. Update .env file:"
echo "   nano .env"
echo "   # Update SMTP_PASS to: ltfxlvlosfxqcrnd"
echo "   # Save: Ctrl+X, then Y, then Enter"
echo ""
echo "3. Restart PM2:"
echo "   pm2 restart hadi-books-store --update-env"
echo ""
echo "4. Check logs:"
echo "   pm2 logs hadi-books-store --lines 20"
echo ""
echo "========================================="
echo "EXPECTED RESULTS"
echo "========================================="
echo ""
echo "Look for one of these:"
echo "  ✅ Email transporter is ready and configured correctly"
echo "  ❌ Email transporter verification failed: ..."
echo ""
echo "If still failing, Gmail might be blocking your server IP."
echo "Alternative: Use SendGrid (100 free emails/day)"
echo ""
