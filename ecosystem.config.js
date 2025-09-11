module.exports = {
  apps: [{
    name: 'speech-to-text-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5050
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5050
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads', 'whisper_output', 'dist', 'src'],
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
