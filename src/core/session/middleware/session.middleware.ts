/**
 * Express Session Middleware
 *
 * Attaches the authenticated session to every request.
 *
 * Flow:
 * 1. Extract session ID from cookie (if present)
 * 2. Look up session in store
 * 3. Refresh idle timeout on successful lookup
 * 4. Attach session to req.session (or null if not authenticated)
 * 5. Continue to next middleware
 *
 * Security:
 * - Session ID is opaque (cannot be forged by client)
 * - Session is looked up server-side on every request
 * - Expired/revoked sessions return null
 * - No authentication state is assumed; each request verifies
 */

import type { Request, Response, NextFunction } from 'express';
import { SessionConfig } from '../session.types';
import { SessionStore } from '../session-store.port';
import './express.augment';

// Note: Express type augmentation (SessionRecord on Request) is in express.augment.ts

/**
 * Create Express middleware for session handling.
 *
 * @param store Session store implementation
 * @param config Session configuration (cookies, timeouts)
 */
export function createSessionMiddleware(store: SessionStore, config: SessionConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract session ID from cookie
      const sessionId = req.cookies[config.cookieName];

      if (!sessionId) {
        // No session cookie — guest request
        req.session = undefined;
        return next();
      }

      // Look up session in store
      const session = await store.get(sessionId);

      if (!session) {
        // Session not found, expired, or revoked
        // Clear the stale cookie from browser
        res.clearCookie(config.cookieName, {
          path: config.cookiePath,
          domain: config.cookieDomain,
        });
        req.session = undefined;
        return next();
      }

      // Refresh idle timeout (extend session if still active)
      const refreshed = await store.refresh(sessionId);
      if (!refreshed.ok) {
        // Refresh failed (shouldn't happen if get succeeded, but be safe)
        res.clearCookie(config.cookieName, {
          path: config.cookiePath,
          domain: config.cookieDomain,
        });
        req.session = undefined;
        return next();
      }

      // Attach refreshed session to request
      req.session = refreshed.session;
      next();
    } catch (error) {
      // Session lookup error — don't crash, just treat as unauthenticated
      console.error('[Session] Middleware error:', error);
      req.session = undefined;
      next();
    }
  };
}

/**
 * Middleware to require authentication.
 * Use in routes that need a valid session.
 * (Exported for Phase 3F.2 authentication endpoints)
 */
 
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session) {
    res.status(401).json({
      ok: false,
      error: { code: 'noSession', message: 'Authentication required' },
    });
    return;
  }

  next();
}

/**
 * Middleware to set secure session cookie after login.
 * (Exported for Phase 3F.2 login endpoint)
 *
 * Usage:
 * ```
 * const session = await sessionStore.create({ customerId, email });
 * setSessionCookie(res, session.id, config);
 * res.json({ ok: true, user: ... });
 * ```
 */
 
export function setSessionCookie(res: Response, sessionId: string, config: SessionConfig): void {
  res.cookie(config.cookieName, sessionId, {
    httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
    secure: config.cookieSecure, // HTTPS only
    sameSite: config.cookieSameSite, // CSRF protection
    path: config.cookiePath,
    domain: config.cookieDomain,
    // Don't set maxAge here — let the store enforce expiry server-side
    // Browser will discard cookie when closed if no maxAge is set
  });
}

/**
 * Middleware to clear session cookie on logout.
 * (Exported for Phase 3F.2 logout endpoint)
 *
 * Usage:
 * ```
 * await sessionStore.destroy(req.session.id);
 * clearSessionCookie(res, config);
 * res.json({ ok: true });
 * ```
 */
 
export function clearSessionCookie(res: Response, config: SessionConfig): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: config.cookiePath,
    domain: config.cookieDomain,
  });
}
