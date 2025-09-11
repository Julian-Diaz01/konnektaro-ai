import express, { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../middleware/auth';
import { upload, handleUploadError } from '../middleware/upload';
import transcriptionController from '../controllers/transcriptionController';
import logger from '../utils/logger';

const router = express.Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'speech-to-text-api',
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});

// API info endpoint
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'Speech-to-Text API',
      version: process.env.npm_package_version || '1.0.0',
      endpoints: {
        health: 'GET /health - Service health check',
        transcribe: 'POST /transcribe - Upload audio file for transcription',
        models: 'GET /models - Get available Whisper models',
        languages: 'GET /languages - Get supported languages'
      },
      authentication: 'Bearer token required for transcription endpoints'
    }
  });
});

// Get available models (public endpoint)
router.get('/models', transcriptionController.getModels);

// Get supported languages (public endpoint)
router.get('/languages', transcriptionController.getLanguages);

// Transcribe audio (authenticated endpoint)
router.post('/transcribe', 
  verifyFirebaseToken,
  upload.single('audio'),
  handleUploadError,
  transcriptionController.transcribeAudio
);

// Error handling middleware
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { message: error.message })
  });
});

export default router;
