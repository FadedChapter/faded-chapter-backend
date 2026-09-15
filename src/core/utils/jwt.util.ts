/**
 * JWT Utilities
 * Token generation and verification helpers
 *
 * Phase 3: API Layer
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JWTPayload {
  customer_id: string;
  store_id: string;
  session_id: string;
  iat: number;
  exp: number;
}

/**
 * Generate JWT token
 */
export function generateToken(customerId: string, storeId: string, sessionId: string): string {
  const expiresIn = '24h'; // Same as session duration

  return jwt.sign(
    {
      customer_id: customerId,
      store_id: storeId,
      session_id: sessionId,
    },
    env.get('JWT_SECRET'),
    { expiresIn }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, env.get('JWT_SECRET')) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Decode JWT token without verification (for inspection only)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload | null;
  } catch (error) {
    return null;
  }
}
