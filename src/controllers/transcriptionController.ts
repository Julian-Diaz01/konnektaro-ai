import { Request, Response } from 'express';
import whisperService from '../services/whisperService';
import logger from '../utils/logger';
import fs from 'fs';

// Performance metrics tracking
interface PerformanceMetrics {
  totalTranscriptions: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
  lastReset: string;
}

let performanceMetrics: PerformanceMetrics = {
  totalTranscriptions: 0,
  averageProcessingTime: 0,
  totalProcessingTime: 0,
  lastReset: new Date().toISOString()
};

class TranscriptionController {
  async transcribeAudio(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No audio file uploaded',
          code: 'NO_FILE'
        });
        return;
      }

      const audioFilePath = req.file.path;
      const user = req.user;
      
      logger.info(`Processing audio file: ${audioFilePath} for user: ${user?.email || 'anonymous'}`);

      // Convert audio to text using Whisper
      const userId = user?.uid || 'anonymous';
      const language = req.body.language || req.query.language || 'en'; // Default to English
      const result = await whisperService.transcribe(audioFilePath, userId, language);
      
      // Clean up uploaded file
      fs.unlinkSync(audioFilePath);
      logger.info(`File cleaned up: ${audioFilePath}`);

      // Update performance metrics
      performanceMetrics.totalTranscriptions++;
      performanceMetrics.totalProcessingTime += result.processingTime;
      performanceMetrics.averageProcessingTime = 
        performanceMetrics.totalProcessingTime / performanceMetrics.totalTranscriptions;

      // Return successful response
      res.json({
        success: true,
        data: {
          transcription: result.text,
          model: result.model,
          language: result.language,
          filename: req.file.originalname,
          size: req.file.size,
          processingTime: result.processingTime,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Transcription error:', error);
      
      // Clean up file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process audio file',
        message: (error as Error).message,
        code: 'TRANSCRIPTION_FAILED'
      });
    }
  }

  async getModels(req: Request, res: Response): Promise<void> {
    try {
      const models = await whisperService.getAvailableModels();
      res.json({
        success: true,
        data: {
          models,
          current: process.env.WHISPER_MODEL || 'tiny',
          note: 'Model is fixed by the service for optimal performance'
        }
      });
    } catch (error) {
      logger.error('Error getting models:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available models',
        code: 'MODELS_FETCH_FAILED'
      });
    }
  }

  async getLanguages(req: Request, res: Response): Promise<void> {
    try {
      const languages = await whisperService.getSupportedLanguages();
      res.json({
        success: true,
        data: {
          languages,
          default: 'en',
          note: 'Language is optional in transcription requests, defaults to English'
        }
      });
    } catch (error) {
      logger.error('Error getting languages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get supported languages',
        code: 'LANGUAGES_FETCH_FAILED'
      });
    }
  }

  async getQueueStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = whisperService.getQueueStatus();
      res.json({
        success: true,
        data: {
          ...status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting queue status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
        code: 'QUEUE_STATUS_FAILED'
      });
    }
  }

  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const queueStatus = whisperService.getQueueStatus();
      
      res.json({
        success: true,
        data: {
          performance: performanceMetrics,
          queue: queueStatus,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Performance metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        message: (error as Error).message
      });
    }
  }

  async resetPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      performanceMetrics = {
        totalTranscriptions: 0,
        averageProcessingTime: 0,
        totalProcessingTime: 0,
        lastReset: new Date().toISOString()
      };
      
      res.json({
        success: true,
        message: 'Performance metrics reset successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Reset performance metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset performance metrics',
        message: (error as Error).message
      });
    }
  }
}

export default new TranscriptionController();
