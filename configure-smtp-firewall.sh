#!/bin/bash

echo "========================================="
echo "DIGITALOCEAN FIREWALL CONFIGURATION"
echo "========================================="
echo ""

# Check if firewall is active
echo "Step 1: Checking firewall status..."
echo "-----------------------------------"
sudo ufw status
echo ""

# Check current iptables rules
echo "Step 2: Checking current iptables rules..."
echo "-------------------------------------------"
sudo iptables -L OUTPUT -n -v | grep -E "smtp|465|587"
echo ""

# Allow outbound connections to ports 465 and 587
echo "Step 3: Adding firewall rules for SMTP ports..."
echo "------------------------------------------------"

# Allow port 465 (SMTPS)
echo "Opening port 465 (SMTPS/SSL)..."
sudo iptables -A OUTPUT -p tcp --dport 465 -j ACCEPT
sudo ufw allow out 465/tcp
echo "✓ Port 465 rule added"

# Allow port 587 (SMTP with STARTTLS)
echo "Opening port 587 (SMTP/TLS)..."
sudo iptables -A OUTPUT -p tcp --dport 587 -j ACCEPT
sudo ufw allow out 587/tcp
echo "✓ Port 587 rule added"

# Also allow port 25 (standard SMTP)
echo "Opening port 25 (SMTP)..."
sudo iptables -A OUTPUT -p tcp --dport 25 -j ACCEPT
sudo ufw allow out 25/tcp
echo "✓ Port 25 rule added"

echo ""
echo "Step 4: Saving iptables rules..."
echo "--------------------------------"
sudo netfilter-persistent save 2>/dev/null || echo "Note: netfilter-persistent not installed (rules may not persist after reboot)"

echo ""
echo "Step 5: Testing SMTP ports again..."
echo "------------------------------------"

# Test port 465
timeout 5 bash -c "</dev/tcp/smtp.gmail.com/465" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Port 465 is NOW OPEN"
else
  echo "❌ Port 465 is STILL BLOCKED"
fi

# Test port 587
timeout 5 bash -c "</dev/tcp/smtp.gmail.com/587" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Port 587 is NOW OPEN"
else
  echo "❌ Port 587 is STILL BLOCKED"
fi

echo ""
echo "========================================="
echo "IMPORTANT NOTES"
echo "========================================="
echo ""
echo "If ports are STILL BLOCKED after this:"
echo "1. DigitalOcean may have a regional block on SMTP ports"
echo "2. You need to contact DigitalOcean support to request SMTP access"
echo "3. OR use SendGrid/Mailgun as email service (recommended)"
echo ""
echo "To verify with DigitalOcean:"
echo "- Open a support ticket at: https://cloud.digitalocean.com/support/tickets"
echo "- Request: 'Please unblock SMTP ports (25, 465, 587) for my droplet'"
echo "- Mention: 'Needed for transactional emails from my e-commerce store'"
echo ""
echo "========================================="
echo "ALTERNATIVE: USE SENDGRID (5 MINUTES)"
echo "========================================="
echo ""
echo "SendGrid is more reliable and doesn't require SMTP ports:"
echo "1. Sign up: https://sendgrid.com/ (free tier: 100 emails/day)"
echo "2. Get API key from: Settings → API Keys → Create API Key"
echo "3. Update .env:"
echo "   SMTP_HOST=smtp.sendgrid.net"
echo "   SMTP_PORT=587"
echo "   SMTP_USER=apikey"
echo "   SMTP_PASS=your_sendgrid_api_key"
echo "4. Restart PM2: pm2 restart hadi-books-store --update-env"
echo ""
echo "SendGrid uses their own relay servers and works from any IP."
echo ""
