import multer, { MulterError } from 'multer';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';
import { Request, Response, NextFunction } from 'express';

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    const uploadDir = 'uploads';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

// File filter function
const fileFilter = function (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  logger.info(`File upload attempt: ${file.originalname}, MIME type: ${file.mimetype}`);
  
  const allowedMimes = config.upload.allowedMimes;
  const allowedExtensions = config.upload.allowedExtensions;
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    logger.info(`File accepted: ${file.originalname}`);
    cb(null, true);
  } else {
    logger.warn(`File rejected: ${file.originalname}, MIME: ${file.mimetype}, Extension: ${fileExtension}`);
    const error = new Error(`Only audio files are allowed! Received: ${file.mimetype} (${fileExtension})`);
    cb(error as any, false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: fileFilter
});

// Error handling middleware for multer
export const handleUploadError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${config.upload.maxFileSize / (1024 * 1024)}MB.`,
        code: 'FILE_TOO_LARGE'
      });
      return;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        error: 'Too many files uploaded.',
        code: 'TOO_MANY_FILES'
      });
      return;
    }
  }
  
  if (error.message.includes('Only audio files are allowed')) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
    return;
  }
  
  next(error);
};

export { upload };
