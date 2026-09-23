/**
 * Auth Middleware
 * JWT token validation and session verification
 *
 * Phase 3: API Layer
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SessionService } from '../services/session.service';
import { AuthenticationError } from '../errors/app-error';
import { getConfig } from '../config/env';

export interface JWTPayload {
  customer_id: string;
  store_id: string;
  session_id: string;
  iat: number;
  exp: number;
}

export function requireAuth(sessionService: SessionService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);

      // Verify JWT signature
      let payload: JWTPayload;
      try {
        const config = getConfig();
        payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
      } catch (err) {
        throw new AuthenticationError('Invalid or expired token');
      }

      // Get store from request context
      const storeId = req.storeId;

      if (!storeId || storeId !== payload.store_id) {
        throw new AuthenticationError('Store mismatch');
      }

      // Verify session is still valid (by ID from JWT payload)
      try {
        const session = await sessionService.verifySessionById(payload.session_id, storeId);

        // Attach to request
        req.customerId = payload.customer_id;
        req.sessionId = session.id;
        req.jwtPayload = payload;

        next();
      } catch (err) {
        throw new AuthenticationError('Session invalid or expired');
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json(error.toResponse());
      } else {
        res.status(401).json({
          error: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed',
        });
      }
    }
  };
}

export function optionalAuth(sessionService: SessionService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      const token = authHeader.substring(7);
      const storeId = req.storeId;

      // Verify JWT signature
      let payload: JWTPayload;
      try {
        const config = getConfig();
        payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
      } catch (err) {
        // Invalid token, but optional so continue
        return next();
      }

      if (!storeId || storeId !== payload.store_id) {
        return next();
      }

      try {
        const session = await sessionService.verifySessionById(payload.session_id, storeId);
        req.customerId = payload.customer_id;
        req.sessionId = session.id;
        req.jwtPayload = payload;
      } catch (err) {
        // Session invalid, but optional so continue
      }

      next();
    } catch (error) {
      // Silently continue on optional auth errors
      next();
    }
  };
}
