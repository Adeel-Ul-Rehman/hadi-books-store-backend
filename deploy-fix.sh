#!/bin/bash
# Deployment Script for DigitalOcean Droplet
# Run this on your DigitalOcean droplet via SSH

echo "🔄 Starting deployment..."

# Navigate to server directory (adjust path if needed)
cd ~/books/server || cd /root/books/server || cd /var/www/books/server

echo "📦 Installing dependencies (if needed)..."
npm install

echo "🔄 Restarting PM2 process..."
pm2 restart all

echo "⏳ Waiting for server to stabilize..."
sleep 3

echo "📊 Checking server status..."
pm2 status

echo ""
echo "📋 Recent server logs:"
pm2 logs server --lines 30 --nostream

echo ""
echo "✅ Deployment complete!"
echo "🌐 Test your site at: https://www.hadibookstore.shop"
echo "🔍 Monitor logs with: pm2 logs server"
