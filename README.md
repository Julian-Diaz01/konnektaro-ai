# 🎤 Speech-to-Text API

A production-ready TypeScript API for speech-to-text conversion using local Whisper with Firebase authentication.

## ✨ Features

- 🎤 **Local Whisper Integration** - 100% free, runs on your server
- 🔐 **Firebase Authentication** - Secure token-based authentication
- 📝 **High-Quality Transcription** - Multiple Whisper models available
- 🌍 **Multi-Language Support** - 99+ languages supported
- 🔄 **Multiple Audio Formats** - WAV, MP3, MP4, AAC, OGG, WebM, FLAC
- 🛡️ **Production Ready** - Rate limiting, logging, error handling
- 📊 **Scalable Architecture** - Modular, maintainable TypeScript codebase
- 🐳 **Docker Support** - Containerized deployment
- 📈 **Monitoring** - Health checks, structured logging

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.8+
- **Whisper** installed locally
- **Firebase** project with service account

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/konnektaro-ai.git
cd konnektaro-ai

# Install dependencies
npm install

# Install Whisper
pip install openai-whisper

# Configure environment
cp env.example .env
# Edit .env with your Firebase credentials

# Start server
npm run dev
```

The API will be available at `http://localhost:5050/api`

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

### Example Usage

```bash
# Health check
curl https://yourdomain.com/api/health

# Transcribe audio (with authentication)
curl -X POST \
  -H "Authorization: Bearer <your-firebase-token>" \
  -F "audio=@your-audio-file.mp3" \
  https://yourdomain.com/api/transcribe
```

## 🏗️ Architecture

```
src/
├── config/           # Configuration management
├── controllers/      # Request handlers
├── middleware/       # Authentication, upload, error handling
├── routes/          # API route definitions
├── services/        # Business logic (Whisper, Firebase)
└── utils/           # Utilities (logging, helpers)
```

## 🔧 Configuration

Copy `env.example` to `.env` and configure:

```bash
# Server
NODE_ENV=production
PORT=5050

# Whisper
WHISPER_MODEL=base
WHISPER_LANGUAGE=en

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Linux Server Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production deployment instructions.

### PM2 Process Management

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

## 📦 Dependencies

### Core Dependencies
- **express**: Web framework
- **multer**: File upload handling
- **cors**: Cross-origin resource sharing
- **firebase-admin**: Firebase authentication
- **helmet**: Security middleware
- **morgan**: HTTP request logger
- **compression**: Response compression
- **express-rate-limit**: Rate limiting
- **winston**: Structured logging

### Development Dependencies
- **typescript**: TypeScript compiler
- **@types/node**: Node.js type definitions
- **@types/express**: Express type definitions
- **ts-node**: TypeScript execution for Node.js
- **dotenv**: Environment variable management

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

## 📄 License

ISC License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For issues and questions:
- Check the [Deployment Guide](./DEPLOYMENT.md)
- Review logs: `pm2 logs speech-to-text-api`
- Health check: `curl localhost:5050/api/health`

## 🎯 Roadmap

- [ ] WebSocket support for real-time transcription
- [ ] Batch processing for multiple files
- [ ] Custom model training
- [ ] API rate limiting per user
- [ ] Transcription history and management
- [ ] Web interface for testing