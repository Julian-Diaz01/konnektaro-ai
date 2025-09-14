import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

import config from './config';
import logger from './utils/logger';
import apiRoutes from './routes/api';

class App {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL2
    ].filter((origin): origin is string => Boolean(origin));
    
    this.app.use(cors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim())
      }
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', apiRoutes);

    // Root route
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          service: 'Speech-to-Text API',
          version: process.env.npm_package_version || '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          documentation: '/api'
        }
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled application error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(config.nodeEnv === 'development' && { 
          message: error.message,
          stack: error.stack 
        })
      });
    });
  }

  public start(): void {
    const port = config.port;
    
    // Get allowed origins for logging
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL2
    ].filter((origin): origin is string => Boolean(origin));
    
    this.app.listen(port, () => {
      // Always log startup messages to console for visibility
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📡 API endpoint: http://localhost:${port}/api`);
      console.log(`🏥 Health check: http://localhost:${port}/api/health`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`🎤 Whisper model: ${config.whisper.model}`);
      console.log(`🗣️  Whisper language: ${config.whisper.language}`);
      console.log(`🔒 Allowed CORS origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'None configured'}`);
      
      // Also log to winston logger for file logging
      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`📡 API endpoint: http://localhost:${port}/api`);
      logger.info(`🏥 Health check: http://localhost:${port}/api/health`);
      logger.info(`🌍 Environment: ${config.nodeEnv}`);
      logger.info(`🎤 Whisper model: ${config.whisper.model}`);
      logger.info(`🗣️  Whisper language: ${config.whisper.language}`);
      logger.info(`🔒 Allowed CORS origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'None configured'}`);
    });
  }
}

export default App;
