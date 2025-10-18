/**
 * PM2 Health Monitor
 * Ensures the server NEVER stays down
 * Runs as a separate PM2 process
 */

import { exec } from 'child_process';
import http from 'http';

const APP_NAME = 'hadi-books-store';
const HEALTH_CHECK_URL = 'http://localhost:4000/health';
const CHECK_INTERVAL = 30000; // 30 seconds
const RESTART_TIMEOUT = 10000; // 10 seconds

console.log('🔍 PM2 Health Monitor Started');
console.log(`📊 Monitoring: ${APP_NAME}`);
console.log(`⏱️ Check interval: ${CHECK_INTERVAL / 1000}s\n`);

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_CHECK_URL, { timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function getPM2Status() {
  return new Promise((resolve) => {
    exec('pm2 jlist', (error, stdout) => {
      if (error) {
        resolve({ status: 'unknown', error: true });
        return;
      }
      
      try {
        const apps = JSON.parse(stdout);
        const app = apps.find(a => a.name === APP_NAME);
        
        if (!app) {
          resolve({ status: 'not-found', error: true });
          return;
        }
        
        resolve({
          status: app.pm2_env.status,
          restarts: app.pm2_env.restart_time,
          uptime: app.pm2_env.pm_uptime,
          error: false
        });
      } catch (err) {
        resolve({ status: 'parse-error', error: true });
      }
    });
  });
}

function restartApp() {
  return new Promise((resolve) => {
    console.log(`🔄 Restarting ${APP_NAME}...`);
    
    exec(`pm2 restart ${APP_NAME}`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Restart failed:', error.message);
        resolve(false);
        return;
      }
      
      console.log('✅ Restart command executed');
      resolve(true);
    });
  });
}

function startApp() {
  return new Promise((resolve) => {
    console.log(`🚀 Starting ${APP_NAME} from ecosystem config...`);
    
    exec('cd ~/hadi-books-store-backend && pm2 start ecosystem.config.cjs', (error) => {
      if (error) {
        console.error('❌ Start failed:', error.message);
        resolve(false);
        return;
      }
      
      console.log('✅ Start command executed');
      resolve(true);
    });
  });
}

async function monitor() {
  const timestamp = new Date().toISOString();
  
  // Check PM2 status
  const pm2Status = await getPM2Status();
  
  if (pm2Status.error || pm2Status.status !== 'online') {
    console.log(`⚠️ [${timestamp}] PM2 Status: ${pm2Status.status}`);
    
    if (pm2Status.status === 'not-found') {
      console.log('📦 App not found in PM2, starting...');
      await startApp();
    } else {
      await restartApp();
    }
    
    // Wait for restart to complete
    await new Promise(resolve => setTimeout(resolve, RESTART_TIMEOUT));
    
    // Verify restart
    const newStatus = await getPM2Status();
    if (newStatus.status === 'online') {
      console.log(`✅ [${timestamp}] App is now online`);
    } else {
      console.log(`❌ [${timestamp}] App still not online, will retry next cycle`);
    }
    
    return;
  }
  
  // Check health endpoint
  const isHealthy = await checkHealth();
  
  if (!isHealthy) {
    console.log(`⚠️ [${timestamp}] Health check failed, restarting...`);
    await restartApp();
  } else {
    console.log(`✅ [${timestamp}] Status: ${pm2Status.status} | Restarts: ${pm2Status.restarts}`);
  }
}

// Run immediately
monitor().catch(console.error);

// Run periodically
setInterval(() => {
  monitor().catch(console.error);
}, CHECK_INTERVAL);

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n📴 Monitor shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📴 Monitor shutting down...');
  process.exit(0);
});
