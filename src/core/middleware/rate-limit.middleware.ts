/**
 * Rate Limiting Middleware
 * Protects payment endpoints from abuse and DoS attacks
 *
 * Phase 9d: Security & Authorization
 */

import { Request, Response, NextFunction } from 'express';
// `logger` is not an export of ../logging/logger; use the function API.
import { logWarn } from '../logging/logger';

/**
 * Rate Limit Store
 * In-memory store for tracking request counts
 * In production: use Redis for distributed rate limiting
 */
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check rate limit
   * Returns true if request is allowed, false if rate limit exceeded
   */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new window
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    // Check limit
    if (entry.count >= limit) {
      return false;
    }

    // Increment count
    entry.count++;
    return true;
  }

  /**
   * Get remaining requests
   */
  getRemaining(key: string, limit: number): number {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.resetTime) {
      return limit;
    }
    return Math.max(0, limit - entry.count);
  }

  /**
   * Get reset time
   */
  getResetTime(key: string): number {
    const entry = this.store.get(key);
    return entry?.resetTime || Date.now();
  }

  /**
   * Cleanup old entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const store = new RateLimitStore();

// Cleanup every minute
setInterval(() => store.cleanup(), 60000);

/**
 * Rate Limit Config
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in ms
  limit: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  handler?: (req: Request, res: Response) => void; // Custom handler
  skip?: (req: Request) => boolean; // Skip rate limiting for some requests
}

/**
 * Create Rate Limiter
 * Factory function for creating rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs = 60000,
    limit = 100,
    keyGenerator = defaultKeyGenerator,
    handler = defaultHandler,
    skip = () => false,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting if configured
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const allowed = store.check(key, limit, windowMs);

    // Add rate limit headers
    const resetTime = store.getResetTime(key);
    const remaining = store.getRemaining(key, limit);

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

    if (!allowed) {
      logWarn('Rate limit exceeded', {
        key,
        limit,
        endpoint: req.path,
        method: req.method,
      });

      handler(req, res);
      return;
    }

    next();
  };
}

/**
 * Default Key Generator
 * Uses IP address or user ID if authenticated
 */
function defaultKeyGenerator(req: Request): string {
  if (req.auth?.userId) {
    return `user:${req.auth.userId}`;
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Default Handler
 * Returns 429 Too Many Requests
 */
function defaultHandler(req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: res.getHeader('X-RateLimit-Reset'),
  });
}

/**
 * Pre-configured Rate Limiters
 */

// Webhook endpoint - higher limit (Razorpay retries)
export const webhookRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  limit: 1000, // 1000 requests per minute
  keyGenerator: (req) => `webhook:${req.params.storeId || 'global'}`,
});

// Payment creation - strict limit
export const paymentCreationRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  limit: 30, // 30 requests per minute
  keyGenerator: (req) => `payment-create:${req.auth?.userId || req.ip}`,
});

// Refund operations - strict limit (requires admin)
export const refundRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  limit: 20, // 20 requests per minute
  keyGenerator: (req) => `refund:${req.auth?.userId || req.ip}`,
  skip: (req) => req.auth?.role !== 'admin', // Strict for admins only
});

// General API rate limit
export const apiRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  limit: 100, // 100 requests per minute
  keyGenerator: (req) => `api:${req.auth?.userId || req.ip}`,
});

// Login/Auth endpoints - very strict
export const authRateLimit = rateLimit({
  windowMs: 900000, // 15 minutes
  limit: 5, // 5 attempts per 15 minutes
  keyGenerator: (req) => `auth:${req.ip}`,
});

/**
 * Skip Rate Limit For System Operations
 */
export function skipSystemOperations(req: Request): boolean {
  return req.auth?.role === 'system';
}
