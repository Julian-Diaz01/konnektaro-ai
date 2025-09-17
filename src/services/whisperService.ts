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
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs: number = parseInt(process.env.MAX_CONCURRENT_JOBS || '6'); // Increased concurrent jobs
  private jobQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.outputDir = config.whisper.outputDir;
    this.ensureOutputDir();
  }

  private async preprocessAudio(inputPath: string, userId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const outputPath = inputPath.replace(/\.[^/.]+$/, `_${userId}_${timestamp}_${randomId}_processed.wav`);
      
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


  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.jobQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.jobQueue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
      const job = this.jobQueue.shift();
      if (job) {
        job().catch(error => {
          logger.error('Job processing error:', error);
        });
      }
    }

    this.isProcessingQueue = false;
  }

  async transcribe(audioFilePath: string, userId: string = 'anonymous', language: string = 'en'): Promise<TranscriptionResult> {
    return new Promise(async (resolve, reject) => {
      try {
        logger.info(`Starting Whisper transcription for: ${audioFilePath}`);
        
        // Validate file exists
        if (!fs.existsSync(audioFilePath)) {
          throw new Error('Audio file not found');
        }

        // Check if we can process immediately or need to queue
        const jobId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        if (this.activeJobs.size >= this.maxConcurrentJobs) {
          logger.info(`Queueing transcription job ${jobId} - ${this.activeJobs.size} active jobs`);
          
          // Add to queue
          this.jobQueue.push(async () => {
            this.activeJobs.add(jobId);
            try {
              const result = await this.processTranscription(audioFilePath, userId, language);
              resolve(result);
            } catch (error) {
              reject(error);
            } finally {
              this.activeJobs.delete(jobId);
              this.processQueue(); // Process next in queue
            }
          });
          
          this.processQueue();
          return;
        }

        // Process immediately
        this.activeJobs.add(jobId);
        try {
          const result = await this.processTranscription(audioFilePath, userId, language);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeJobs.delete(jobId);
          this.processQueue(); // Process next in queue
        }
      } catch (error) {
        logger.error('Whisper transcription error:', error);
        reject(new Error(`Audio processing error: ${(error as Error).message}`));
      }
    });
  }

  private async processTranscription(audioFilePath: string, userId: string, language: string = 'en'): Promise<TranscriptionResult> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      try {

        // Get file info
        const stats = fs.statSync(audioFilePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        logger.info(`File size: ${fileSizeInMB} MB`);

        // Preprocess audio for faster transcription
        const processedAudioPath = await this.preprocessAudio(audioFilePath, userId);
        const finalAudioPath = processedAudioPath !== audioFilePath ? processedAudioPath : audioFilePath;

        // Prepare Whisper command arguments with performance optimizations
        const whisperArgs = [
          finalAudioPath,
          '--model', config.whisper.model,
          '--language', language,
          '--output_dir', this.outputDir,
          '--output_format', 'txt',
          '--verbose', 'False',
          '--fp16', 'True', // Use half precision for faster processing
          '--condition_on_previous_text', 'False', // Disable for speed
          '--compression_ratio_threshold', '2.4', // Skip processing if compression is too high
          '--no_speech_threshold', '0.6', // Skip if no speech detected
          '--temperature', '0.0', // Deterministic output for consistency
          '--best_of', '1', // Reduce beam search for speed
          '--beam_size', '1' // Single beam for faster processing
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
              
              const processingTime = Date.now() - startTime;
              const result = {
                text: transcription,
                model: config.whisper.model,
                language: language,
                processingTime: processingTime
              };

              logger.info(`Transcription completed in ${processingTime}ms for ${fileSizeInMB}MB file`);
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

  getQueueStatus(): { active: number; queued: number; maxConcurrent: number } {
    return {
      active: this.activeJobs.size,
      queued: this.jobQueue.length,
      maxConcurrent: this.maxConcurrentJobs
    };
  }
}

export default new WhisperService();
