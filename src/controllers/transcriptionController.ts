import { Request, Response } from 'express';
import whisperService from '../services/whisperService';
import logger from '../utils/logger';
import fs from 'fs';

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
      const result = await whisperService.transcribe(audioFilePath);
      
      // Clean up uploaded file
      fs.unlinkSync(audioFilePath);
      logger.info(`File cleaned up: ${audioFilePath}`);

      // Return successful response
      res.json({
        success: true,
        data: {
          transcription: result.text,
          model: result.model,
          language: result.language,
          filename: req.file.originalname,
          size: req.file.size,
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
          current: process.env.WHISPER_MODEL || 'base'
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
          current: process.env.WHISPER_LANGUAGE || 'en'
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
}

export default new TranscriptionController();
