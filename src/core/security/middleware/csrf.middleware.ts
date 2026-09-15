/**
 * CSRF Protection — double-submit cookie
 *
 * Phase 0: Security boundary.
 *
 * Why this matters here: the API supports cookie-based sessions
 * (createSessionMiddleware / setSessionCookie). Any credential the browser
 * attaches automatically is CSRF-able, so state-changing requests need a token
 * the attacker's origin cannot read.
 *
 * Scheme:
 *   1. On a safe request (GET/HEAD/OPTIONS) we ensure a random token exists in
 *      a readable, SameSite=Strict cookie.
 *   2. The client echoes that value in the X-CSRF-Token header.
 *   3. State-changing requests must present header === cookie.
 *
 * A cross-origin attacker can cause the cookie to be *sent* but cannot *read*
 * it, so it cannot populate the header. Comparison is constant-time.
 *
 * NOTE: the previous implementation only checked that the header was non-empty,
 * which any attacker could satisfy with an arbitrary string. That is why this
 * was rewritten rather than simply re-enabled.
 */

import type { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_COOKIE_NAME = 'csrf-token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Bearer-authenticated requests carry no ambient credential, so no CSRF risk. */
function usesBearerAuth(req: Request): boolean {
  const header = req.headers.authorization;
  return typeof header === 'string' && header.startsWith('Bearer ');
}

function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Issue the CSRF cookie when missing. Safe to call on every request.
 * Not HttpOnly by design — the client must read it to echo it back.
 */
export function issueCsrfCookie(req: Request, res: Response): string {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === 'string' && existing.length >= 32) {
    return existing;
  }

  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
  });
  return token;
}

/**
 * CSRF validation middleware factory.
 *
 * @param enabled Pass false ONLY in automated tests. Disabling this in a running
 *                environment removes CSRF protection entirely.
 */
export function createCsrfMiddleware(enabled = true) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      return next();
    }

    const method = req.method.toUpperCase();

    if (SAFE_METHODS.has(method)) {
      issueCsrfCookie(req, res);
      return next();
    }

    // Token-authenticated calls (mobile clients, server-to-server, the admin
    // SPA's Bearer requests) are not subject to ambient-credential CSRF.
    if (usesBearerAuth(req)) {
      return next();
    }

    const headerToken = req.headers[CSRF_HEADER_NAME];
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    if (typeof headerToken !== 'string' || headerToken.length === 0) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'csrfTokenMissing',
          message: 'CSRF token required for state-changing requests',
        },
      });
    }

    if (typeof cookieToken !== 'string' || !constantTimeEquals(headerToken, cookieToken)) {
      console.warn('[CSRF] Token mismatch on', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      return res.status(403).json({
        ok: false,
        error: {
          code: 'csrfTokenInvalid',
          message: 'Invalid CSRF token',
        },
      });
    }

    return next();
  };
}

/**
 * Endpoint helper: GET /api/csrf-token
 * Lets a client bootstrap a token before its first state-changing request.
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  const token = issueCsrfCookie(req, res);
  res.json({ ok: true, data: { csrfToken: token } });
}
