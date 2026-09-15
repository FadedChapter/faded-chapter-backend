/**
 * JWT Service
 *
 * Handles JWT token generation and verification for stateless authentication.
 * Phase 3F.2: JWT-based auth (replaces session cookies)
 */

import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

type JwtPayload = jwt.JwtPayload;

const JWT_EXPIRY = '24h';

/**
 * Resolve the signing secret from validated configuration.
 *
 * Deliberately resolved per-call rather than at module load: this module is
 * imported during route construction, which can run before loadConfig(), and a
 * module-level env.get() would throw at import time.
 *
 * There is NO fallback secret. A missing/short JWT_SECRET must fail loudly —
 * env.ts enforces a >=32 character value at startup.
 */
function getSecret(): string {
  return env.get('JWT_SECRET') as string;
}

export interface AuthTokenPayload extends JwtPayload {
  userId: string;
  email: string;
  emailVerified: boolean;
  /**
   * Authorisation roles carried as a signed claim.
   * This is the sole server-trusted source of a caller's role.
   */
  roles: readonly string[];
  /**
   * Signed store binding, used by checkStoreOwnership.
   * Must come from the token — deriving it from the request would make the
   * ownership comparison a tautology.
   */
  storeId: string;
}

/**
 * Generate JWT token for user
 */
export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: JWT_EXPIRY,
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode JWT token.
 * Returns null on any verification failure — callers must treat null as unauthenticated.
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), {
      algorithms: ['HS256'],
    });
    return decoded as AuthTokenPayload;
  } catch (error) {
    console.error('[JWT] Verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}
