import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';

export interface TranscriptionResult {
  text: string;
  model: string;
  language: string;
  processingTime: number;
}

export interface WhisperModel {
  name: string;
  size: string;
  speed: string;
  accuracy: string;
}

class WhisperService {
  private outputDir: string;

  constructor() {
    this.outputDir = config.whisper.outputDir;
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.info(`Created Whisper output directory: ${this.outputDir}`);
    }
  }

  async transcribe(audioFilePath: string): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Starting Whisper transcription for: ${audioFilePath}`);
        
        // Validate file exists
        if (!fs.existsSync(audioFilePath)) {
          throw new Error('Audio file not found');
        }

        // Get file info
        const stats = fs.statSync(audioFilePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        logger.info(`File size: ${fileSizeInMB} MB`);

        // Prepare Whisper command arguments
        const whisperArgs = [
          audioFilePath,
          '--model', config.whisper.model,
          '--language', config.whisper.language,
          '--output_dir', this.outputDir,
          '--output_format', 'txt',
          '--verbose', 'False'
        ];

        logger.info(`Running Whisper command: whisper ${whisperArgs.join(' ')}`);

        // Spawn Whisper process
        const whisperProcess: ChildProcess = spawn('whisper', whisperArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        whisperProcess.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
          logger.debug('Whisper stdout:', data.toString());
        });

        whisperProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
          logger.debug('Whisper stderr:', data.toString());
        });

        whisperProcess.on('close', (code: number | null) => {
          if (code === 0) {
            // Whisper completed successfully
            const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
            const txtFile = path.join(this.outputDir, `${baseName}.txt`);
            
            if (fs.existsSync(txtFile)) {
              const transcription = fs.readFileSync(txtFile, 'utf8').trim();
              logger.info('Transcription completed successfully');
              
              // Clean up the output file
              fs.unlinkSync(txtFile);
              
              resolve({
                text: transcription,
                model: config.whisper.model,
                language: config.whisper.language,
                processingTime: Date.now()
              });
            } else {
              reject(new Error('Whisper output file not found'));
            }
          } else {
            logger.error('Whisper process failed with code:', code);
            logger.error('Whisper stderr:', stderr);
            reject(new Error(`Whisper process failed: ${stderr}`));
          }
        });

        whisperProcess.on('error', (error: Error) => {
          logger.error('Failed to start Whisper process:', error);
          reject(new Error(`Failed to start Whisper: ${error.message}`));
        });

      } catch (error) {
        logger.error('Whisper transcription error:', error);
        reject(new Error(`Audio processing error: ${(error as Error).message}`));
      }
    });
  }

  async getAvailableModels(): Promise<WhisperModel[]> {
    return [
      { name: 'tiny', size: '39 MB', speed: 'fastest', accuracy: 'basic' },
      { name: 'base', size: '74 MB', speed: 'fast', accuracy: 'good' },
      { name: 'small', size: '244 MB', speed: 'medium', accuracy: 'better' },
      { name: 'medium', size: '769 MB', speed: 'slow', accuracy: 'high' },
      { name: 'large', size: '1550 MB', speed: 'slowest', accuracy: 'best' }
    ];
  }

  async getSupportedLanguages(): Promise<string[]> {
    return [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi'
    ];
  }
}

export default new WhisperService();
