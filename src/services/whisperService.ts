import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
  private cacheDir: string;

  constructor() {
    this.outputDir = config.whisper.outputDir;
    this.cacheDir = path.join(this.outputDir, 'cache');
    this.ensureOutputDir();
    this.ensureCacheDir();
  }

  private async preprocessAudio(inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace(/\.[^/.]+$/, '_processed.wav');
      
      // Use ffmpeg to convert and optimize audio for faster processing
      const ffmpegArgs = [
        '-i', inputPath,
        '-ar', '16000', // Resample to 16kHz (Whisper's optimal sample rate)
        '-ac', '1', // Convert to mono
        '-acodec', 'pcm_s16le', // Use 16-bit PCM
        '-y', // Overwrite output file
        outputPath
      ];

      logger.info(`Preprocessing audio: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';

      ffmpegProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code: number | null) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          logger.info(`Audio preprocessing completed: ${outputPath}`);
          resolve(outputPath);
        } else {
          logger.warn('FFmpeg preprocessing failed, using original file');
          resolve(inputPath); // Fallback to original file
        }
      });

      ffmpegProcess.on('error', (error: Error) => {
        logger.warn('FFmpeg not available, using original file:', error.message);
        resolve(inputPath); // Fallback to original file
      });
    });
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.info(`Created Whisper output directory: ${this.outputDir}`);
    }
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info(`Created cache directory: ${this.cacheDir}`);
    }
  }

  private getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  private getCachedTranscription(fileHash: string): TranscriptionResult | null {
    const cacheFile = path.join(this.cacheDir, `${fileHash}.json`);
    if (fs.existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        logger.info('Using cached transcription');
        return cached;
      } catch (error) {
        logger.warn('Failed to read cache file:', error);
      }
    }
    return null;
  }

  private saveCachedTranscription(fileHash: string, result: TranscriptionResult): void {
    const cacheFile = path.join(this.cacheDir, `${fileHash}.json`);
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2));
      logger.info(`Cached transcription: ${cacheFile}`);
    } catch (error) {
      logger.warn('Failed to save cache file:', error);
    }
  }

  async transcribe(audioFilePath: string): Promise<TranscriptionResult> {
    return new Promise(async (resolve, reject) => {
      try {
        logger.info(`Starting Whisper transcription for: ${audioFilePath}`);
        
        // Validate file exists
        if (!fs.existsSync(audioFilePath)) {
          throw new Error('Audio file not found');
        }

        // Check cache first
        const fileHash = this.getFileHash(audioFilePath);
        const cached = this.getCachedTranscription(fileHash);
        if (cached) {
          resolve(cached);
          return;
        }

        // Get file info
        const stats = fs.statSync(audioFilePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        logger.info(`File size: ${fileSizeInMB} MB`);

        // Preprocess audio for faster transcription
        const processedAudioPath = await this.preprocessAudio(audioFilePath);
        const finalAudioPath = processedAudioPath !== audioFilePath ? processedAudioPath : audioFilePath;

        // Prepare Whisper command arguments with performance optimizations
        const whisperArgs = [
          finalAudioPath,
          '--model', config.whisper.model,
          '--language', config.whisper.language,
          '--output_dir', this.outputDir,
          '--output_format', 'txt',
          '--verbose', 'False',
          '--fp16', 'True', // Use half precision for faster processing
          '--condition_on_previous_text', 'False', // Disable for speed
          '--compression_ratio_threshold', '2.4', // Skip processing if compression is too high
          '--no_speech_threshold', '0.6' // Skip if no speech detected
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
            const baseName = path.basename(finalAudioPath, path.extname(finalAudioPath));
            const txtFile = path.join(this.outputDir, `${baseName}.txt`);
            
            if (fs.existsSync(txtFile)) {
              const transcription = fs.readFileSync(txtFile, 'utf8').trim();
              logger.info('Transcription completed successfully');
              
              // Clean up the output file
              fs.unlinkSync(txtFile);
              
              // Clean up processed file if it was created
              if (finalAudioPath !== audioFilePath && fs.existsSync(finalAudioPath)) {
                fs.unlinkSync(finalAudioPath);
                logger.info(`Cleaned up processed file: ${finalAudioPath}`);
              }
              
              const result = {
                text: transcription,
                model: config.whisper.model,
                language: config.whisper.language,
                processingTime: Date.now()
              };

              // Cache the result
              this.saveCachedTranscription(fileHash, result);
              
              resolve(result);
            } else {
              reject(new Error('Whisper output file not found'));
            }
          } else {
            logger.error('Whisper process failed with code:', code);
            logger.error('Whisper stderr:', stderr);
            
            // Clean up processed file if it was created
            if (finalAudioPath !== audioFilePath && fs.existsSync(finalAudioPath)) {
              fs.unlinkSync(finalAudioPath);
            }
            
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
