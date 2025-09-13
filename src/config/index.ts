import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  whisper: {
    model: string;
    language: string;
    outputDir: string;
  };
  firebase: {
    projectId?: string;
    privateKey?: string;
    clientEmail?: string;
    serviceAccountPath?: string;
  };
  upload: {
    maxFileSize: number;
    allowedMimes: string[];
    allowedExtensions: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
    file: string;
  };
}

const config: Config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '5050'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Whisper Configuration
  whisper: {
    model: process.env.WHISPER_MODEL || 'tiny', // Changed to tiny for faster processing
    language: process.env.WHISPER_LANGUAGE || 'en',
    outputDir: process.env.WHISPER_OUTPUT_DIR || './whisper_output'
  },
  
  // Firebase Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  },
  
  // Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedMimes: [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/webm',
      'audio/flac',
      'application/octet-stream'
    ],
    allowedExtensions: ['.wav', '.mp3', '.mp4', '.aac', '.ogg', '.webm', '.flac', '.m4a']
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100') // limit each IP to 100 requests per windowMs
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  }
};

export default config;
