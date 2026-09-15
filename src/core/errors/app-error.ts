/**
 * Application Error Classes
 * Standardized error handling across the API
 *
 * Phase 0: Infrastructure setup
 */

export interface ErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toResponse(): ErrorResponse {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', message, 403);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error (409)
 * Used for unique constraint violations, duplicate entries, etc.
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super('DATABASE_ERROR', message, 500, {
      originalError: originalError?.message,
    });
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Store isolation violation
 */
export class StoreIsolationError extends AppError {
  constructor(message: string = 'Record does not belong to your store') {
    super('STORE_ISOLATION_VIOLATION', message, 403);
    Object.setPrototypeOf(this, StoreIsolationError.prototype);
  }
}

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
