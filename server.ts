#!/usr/bin/env node

import App from './src/app';
import logger from './src/utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle SIGTERM signal
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// Handle SIGINT signal (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the application
try {
  const app = new App();
  app.start();
} catch (error) {
  logger.error('Failed to start application:', error);
  process.exit(1);
}
