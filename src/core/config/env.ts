/**
 * Environment Configuration & Validation
 * Uses Zod for runtime type-safe validation
 *
 * Phase 0: Infrastructure setup
 */

import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Server
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Database (PostgreSQL)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_MAX_AGE: z.coerce.number().int().default(86400000),

  // Email
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().email('SMTP_USER must be a valid email'),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // CORS
  CORS_ORIGINS: z.string().transform(val => val.split(',')).default('http://localhost:4200,http://localhost:3000'),

  // Feature flags
  FEATURE_EMAIL_VERIFICATION: z.boolean().default(true),
  FEATURE_PASSWORD_RESET: z.boolean().default(true),
  FEATURE_SESSION_TRACKING: z.boolean().default(true),

  // Store configuration
  DEFAULT_STORE_ID: z.string().uuid('DEFAULT_STORE_ID must be a valid UUID'),
  DEFAULT_STORE_NAME: z.string().min(1),
  DEFAULT_CURRENCY: z.string().length(3, 'DEFAULT_CURRENCY must be a 3-letter ISO code'),
  DEFAULT_TIMEZONE: z.string(),
});

type Environment = z.infer<typeof envSchema>;

let config: Environment;

/**
 * Load and validate environment configuration
 * Throws if any required variables are missing or invalid
 */
export function loadConfig(): Environment {
  try {
    config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      console.error('❌ Environment configuration invalid:\n', missingVars);
      console.error('\nSee .env.example for required variables');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Get loaded configuration
 * Must call loadConfig() first
 */
export function getConfig(): Environment {
  if (!config) {
    throw new Error('Configuration not loaded. Call loadConfig() during app startup.');
  }
  return config;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test';
}

/**
 * Environment object for backward compatibility
 * Provides a .get() method to access environment variables
 */
export const env = {
  get: (key: keyof Environment) => getConfig()[key],
};

export type { Environment };
