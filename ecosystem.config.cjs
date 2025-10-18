module.exports = {
  apps: [
    // Main Application
    {
      name: 'hadi-books-store',
      script: './server.js',
      
      // Execution mode
      instances: 1,
      exec_mode: 'fork',
      
      // AUTO-RESTART SETTINGS - CRITICAL
      autorestart: true,              // Always restart on crash
      watch: false,                   // Don't watch files (use git pull instead)
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // Memory management
      max_memory_restart: '500M',     // Restart if memory > 500MB
      
      // Restart behavior
      min_uptime: '3s',               // Must run 3s to be considered started
      max_restarts: 100,              // Allow 100 restarts (unlimited essentially)
      restart_delay: 1000,            // Wait 1s between restarts
      
      // Exponential backoff for rapid crashes
      exp_backoff_restart_delay: 100, // Start with 100ms, doubles each crash
      
      // Graceful shutdown
      kill_timeout: 3000,             // Force kill after 3s
      wait_ready: false,              // Don't wait for ready signal
      listen_timeout: 8000,           // Max time to wait for listen
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      
      // Logging
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced
      instance_var: 'INSTANCE_ID',
      source_map_support: true,
      
      // Post-deploy
      post_update: ['npm install']
    },
    
    // Health Monitor (keeps main app alive)
    {
      name: 'hadi-books-monitor',
      script: './monitor.js',
      
      // Monitor settings
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      
      // Restart behavior
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
      
      // Environment
      env: {
        NODE_ENV: 'production'
      },
      
      // Logging
      error_file: './logs/monitor-error.log',
      out_file: './logs/monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
