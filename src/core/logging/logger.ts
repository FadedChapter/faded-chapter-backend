/**
 * Centralized Logging Service
 * Uses Winston for structured logging with multiple transports
 *
 * Phase 0: Infrastructure setup
 */

import winston, { Logger } from 'winston';
import { getConfig, isDevelopment } from '../config/env';

let logger: Logger;

/**
 * Initialize Winston logger with appropriate transports
 */
export function initializeLogger(): Logger {
  const config = getConfig();

  const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isDevelopment()
      ? winston.format.colorize()
      : winston.format.uncolorize(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
      if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta)}`;
      }
      return logMessage;
    })
  );

  const transports: winston.transport[] = [
    // Console output
    new winston.transports.Console({
      format: isDevelopment()
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp }) => {
              return `${timestamp} ${level}: ${message}`;
            })
          )
        : format,
    }),

    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format,
    }),

    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      format,
    }),
  ];

  logger = winston.createLogger({
    level: config.LOG_LEVEL,
    format,
    defaultMeta: { service: 'faded-chapter-api' },
    transports,
  });

  return logger;
}

/**
 * Get logger instance
 */
export function getLogger(): Logger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initializeLogger() during app startup.');
  }
  return logger;
}

/**
 * Log info message
 */
export function logInfo(message: string, meta?: Record<string, any>): void {
  getLogger().info(message, meta);
}

/**
 * Log warning message
 */
export function logWarn(message: string, meta?: Record<string, any>): void {
  getLogger().warn(message, meta);
}

/**
 * Log error message
 */
export function logError(message: string, error?: Error, meta?: Record<string, any>): void {
  getLogger().error(message, {
    ...meta,
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : undefined,
  });
}

/**
 * Log debug message
 */
export function logDebug(message: string, meta?: Record<string, any>): void {
  getLogger().debug(message, meta);
}

/**
 * Create a child logger with additional metadata
 */
export function createChildLogger(context: string): Logger {
  return getLogger().child({ context });
}
