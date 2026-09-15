/**
 * JWT Middleware
 * Verifies JWT tokens in Authorization header
 * Phase 3F.2: JWT authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, AuthTokenPayload } from '../services/jwt.service';

/**
 * Extend Express Request to include user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload & { id?: string };
      token?: string;
    }
  }
}

/**
 * Extend JWT payload to include id (alias for userId)
 */
declare module '../services/jwt.service' {
  interface AuthTokenPayload {
    id?: string;
  }
}

/**
 * JWT verification middleware
 * Extracts token from Authorization header and verifies it
 * Sets req.user if token is valid
 */
export function verifyJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    res.status(401).json({
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid Authorization header',
      },
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'Invalid or expired token',
      },
    });
    return;
  }

  // Add id as an alias for userId for convenience
  req.user = {
    ...payload,
    id: payload.userId,
  };
  req.token = token;
  next();
}
