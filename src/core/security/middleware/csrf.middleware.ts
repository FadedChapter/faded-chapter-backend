/**
 * CSRF Validation Middleware
 *
 * Validates X-CSRF-Token header on state-changing requests (POST, PUT, DELETE, PATCH).
 *
 * Strategy:
 * - Client sends X-CSRF-Token header (from meta tag) with every state-changing request
 * - Server validates token is present (and will eventually validate it against a session-bound token)
 * - GET requests are skipped (safe operations)
 * - SameSite=Strict cookie provides defense-in-depth
 *
 * Phase 3F.2: Token validation (ensuring header exists)
 * Phase 3F.6: Session-bound token validation (server generates, verifies)
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF validation middleware factory.
 * Creates middleware that validates CSRF tokens on state-changing requests.
 *
 * @param enabled - Whether CSRF protection is enabled (can be disabled for testing)
 */
export function createCsrfMiddleware(enabled = true) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      return next();
    }

    // Skip GET/HEAD/OPTIONS (safe operations)
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    // State-changing request (POST, PUT, DELETE, PATCH)
    // Must include X-CSRF-Token header (from frontend meta tag)
    const token = req.headers['x-csrf-token'];

    if (!token) {
      console.warn('[CSRF] Missing X-CSRF-Token on', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        ok: false,
        error: {
          code: 'csrfTokenMissing',
          message: 'CSRF token required for state-changing requests',
        },
      });
    }

    if (typeof token !== 'string') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'csrfTokenInvalid',
          message: 'Invalid CSRF token',
        },
      });
    }

    // Token is present and valid format
    // In Phase 3F.6, will validate against session-bound token
    // For now, just ensure it exists (defense-in-depth with SameSite=Strict)
    next();
  };
}

/**
 * Middleware to set CSRF token in response.
 * Generates a session-bound token (Phase 3F.6).
 *
 * For now, token generation is deferred. Client reads token from meta tag.
 */
export function setCsrfTokenOnResponse(req: Request, res: Response, next: NextFunction) {
  // Phase 3F.6: Generate and store session-bound CSRF token
  // For now, rely on frontend to read from meta tag
  next();
}
