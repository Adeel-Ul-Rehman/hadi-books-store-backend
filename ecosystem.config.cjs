module.exports = {
  apps: [{
    name: 'hadi-books-store',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Auto-restart configuration
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Restart settings
    min_uptime: '10s',           // Consider app online after 10 seconds
    max_restarts: 10,             // Max 10 restarts within 1 minute
    restart_delay: 4000,          // Wait 4 seconds between restarts
    
    // Exponential backoff restart delay
    exp_backoff_restart_delay: 100,
    
    // Auto-restart on error
    autorestart: true,
    
    // Kill timeout for graceful shutdown
    kill_timeout: 5000,
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Advanced features
    listen_timeout: 10000,        // Wait 10s for app to be ready
    shutdown_with_message: true,
    
    // Crash handling
    min_uptime: '5s',             // App must run for 5s to be considered started
    max_restarts: 15,             // Allow more restarts in 1 minute window
    
    // Instance settings
    instance_var: 'INSTANCE_ID',
    
    // Source map support
    source_map_support: true,
    
    // Auto-restart on specific exit codes
    autorestart: true,
    
    // Post-deploy actions
    post_update: ['npm install'],
  }]
};
