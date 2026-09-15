/**
 * Error Handler Middleware
 * Centralized error handling and response formatting
 *
 * Phase 3: API Layer
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, DatabaseError } from '../errors/app-error';
import { logger } from '../logging/logger';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  traceId?: string;
}

export function errorHandler() {
  return (err: Error | AppError, req: Request, res: Response, next: NextFunction): void => {
    const timestamp = new Date().toISOString();
    const traceId = req.headers['x-trace-id'] as string;

    // AppError subclasses (validation, auth, not found, etc.)
    if (err instanceof AppError) {
      logger.warn('Application error', {
        error: err.name,
        message: err.message,
        statusCode: err.statusCode,
        traceId,
      });

      const response: ErrorResponse = {
        error: err.name,
        message: err.message,
        statusCode: err.statusCode,
        timestamp,
        ...(traceId && { traceId }),
      };

      res.status(err.statusCode).json(response);
      return;
    }

    // Database errors
    if (err.name === 'QueryFailedError' || err.name === 'DatabaseError') {
      logger.error('Database error', {
        message: err.message,
        name: err.name,
        traceId,
      });

      const response: ErrorResponse = {
        error: 'DATABASE_ERROR',
        message: 'A database error occurred',
        statusCode: 500,
        timestamp,
        ...(traceId && { traceId }),
      };

      res.status(500).json(response);
      return;
    }

    // Unexpected errors
    logger.error('Unexpected error', {
      message: err.message,
      name: err.name,
      stack: err.stack,
      traceId,
    });

    const response: ErrorResponse = {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp,
      ...(traceId && { traceId }),
    };

    res.status(500).json(response);
  };
}
