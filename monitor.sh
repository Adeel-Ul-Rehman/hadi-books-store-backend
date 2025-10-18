#!/bin/bash

# PM2 Auto-Restart Monitor Script
# This script ensures the server ALWAYS stays online

APP_NAME="hadi-books-store"
CHECK_INTERVAL=30  # Check every 30 seconds

echo "🔍 Starting PM2 Monitor for $APP_NAME..."
echo "📊 Checking every $CHECK_INTERVAL seconds"

while true; do
    # Get app status
    STATUS=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status")
    
    if [ "$STATUS" == "stopped" ] || [ "$STATUS" == "errored" ] || [ -z "$STATUS" ]; then
        echo "⚠️ [$(date)] App is $STATUS - Restarting..."
        pm2 restart $APP_NAME
        sleep 5
        
        # Verify restart
        NEW_STATUS=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status")
        if [ "$NEW_STATUS" == "online" ]; then
            echo "✅ [$(date)] App restarted successfully"
        else
            echo "❌ [$(date)] Restart failed, trying to start fresh..."
            pm2 delete $APP_NAME 2>/dev/null
            pm2 start ecosystem.config.cjs
        fi
    else
        echo "✅ [$(date)] App is $STATUS - All good"
    fi
    
    sleep $CHECK_INTERVAL
done
