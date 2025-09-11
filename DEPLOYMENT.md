# Speech-to-Text API - Production Deployment Guide

A production-ready Node.js API for speech-to-text conversion using local Whisper with Firebase authentication.

## 🏗️ Architecture Overview

```
src/
├── config/           # Configuration management
├── controllers/      # Request handlers
├── middleware/       # Authentication, upload, error handling
├── routes/          # API route definitions
├── services/        # Business logic (Whisper, Firebase)
└── utils/           # Utilities (logging, helpers)

server.js            # Application entry point
```

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** 18+ 
- **Python** 3.8+
- **Whisper** installed locally
- **Firebase** project with service account

### 2. Installation

```bash
# Clone repository
git clone <your-repo-url>
cd konnektaro-ai

# Install Node.js dependencies
npm install

# Install Whisper
pip install openai-whisper

# Create environment file
cp env.example .env
```

### 3. Configuration

Edit `.env` file with your settings:

```bash
# Server
NODE_ENV=production
PORT=5050
CORS_ORIGIN=https://yourdomain.com

# Whisper
WHISPER_MODEL=base
WHISPER_LANGUAGE=en

# Firebase (see Firebase Setup section)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
```

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm run prod
```

## 🔥 Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Authentication
4. Go to Project Settings → Service Accounts
5. Generate new private key

### 2. Configure Service Account

**Option A: Environment Variables**
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

**Option B: Service Account File**
```bash
# Download service account JSON file
# Place it in ./config/firebase-service-account.json
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
```

### 3. Authentication Setup

The API expects Firebase ID tokens in the Authorization header:

```bash
Authorization: Bearer <firebase-id-token>
```

## 🐧 Linux Server Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and pip
sudo apt install python3 python3-pip -y

# Install Whisper
pip3 install openai-whisper

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Application Deployment

```bash
# Clone your repository
git clone <your-repo-url>
cd konnektaro-ai

# Install dependencies
npm install --production

# Create necessary directories
mkdir -p logs uploads whisper_output config

# Copy environment file
cp env.example .env
# Edit .env with your production settings
```

### 3. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'speech-to-text-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 4. Start with PM2

```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

## 🔒 Security Configuration

### 1. Firewall Setup

```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 2. Nginx Reverse Proxy

Install and configure Nginx:

```bash
sudo apt install nginx -y
```

Create `/etc/nginx/sites-available/speech-to-text-api`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # File upload limits
        client_max_body_size 10M;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/speech-to-text-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring & Logging

### 1. Log Management

```bash
# View logs
pm2 logs speech-to-text-api

# Log rotation
sudo apt install logrotate -y
```

Create `/etc/logrotate.d/speech-to-text-api`:

```
/path/to/your/app/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 nodejs nodejs
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. Health Monitoring

The API provides health check endpoint:

```bash
curl https://yourdomain.com/api/health
```

### 3. Performance Monitoring

```bash
# Monitor PM2 processes
pm2 monit

# View system resources
htop
```

## 🔧 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Server port | `3000` | No |
| `CORS_ORIGIN` | Allowed CORS origins | `*` | No |
| `WHISPER_MODEL` | Whisper model size | `base` | No |
| `WHISPER_LANGUAGE` | Default language | `en` | No |
| `FIREBASE_PROJECT_ID` | Firebase project ID | - | Yes |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | - | Yes |
| `FIREBASE_CLIENT_EMAIL` | Firebase client email | - | Yes |
| `MAX_FILE_SIZE` | Max upload size (bytes) | `10485760` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` | No |
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |
| `LOG_LEVEL` | Logging level | `info` | No |

## 📡 API Endpoints

### Public Endpoints

- `GET /api/health` - Health check
- `GET /api/models` - Available Whisper models
- `GET /api/languages` - Supported languages

### Authenticated Endpoints

- `POST /api/transcribe` - Upload audio for transcription

### Authentication

Include Firebase ID token in Authorization header:

```bash
Authorization: Bearer <firebase-id-token>
```

## 🚨 Troubleshooting

### Common Issues

1. **Whisper not found**
   ```bash
   # Check if Whisper is installed
   which whisper
   pip3 install openai-whisper
   ```

2. **Firebase authentication fails**
   - Verify service account credentials
   - Check Firebase project ID
   - Ensure private key format is correct

3. **File upload fails**
   - Check file size limits
   - Verify file format is supported
   - Check disk space

4. **High memory usage**
   - Use smaller Whisper model (`tiny` or `base`)
   - Monitor with `pm2 monit`

### Logs Location

- Application logs: `./logs/app.log`
- Error logs: `./logs/error.log`
- PM2 logs: `pm2 logs`

## 🔄 Updates & Maintenance

### Updating Application

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install --production

# Restart application
pm2 restart speech-to-text-api
```

### Backup Strategy

```bash
# Backup application
tar -czf backup-$(date +%Y%m%d).tar.gz /path/to/your/app

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz ./logs
```

## 📈 Scaling Considerations

- Use load balancer for multiple instances
- Consider Redis for session management
- Monitor disk space for audio files
- Use CDN for static assets
- Implement database for user management

## 🆘 Support

For issues and support:
- Check logs: `pm2 logs speech-to-text-api`
- Monitor resources: `pm2 monit`
- Health check: `curl localhost:5050/api/health`
