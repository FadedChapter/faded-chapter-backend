/**
 * Express Request Type Extensions
 * Extends Express Request with custom properties
 *
 * Phase 3: API Layer
 */

import { JWTPayload } from '../middleware/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      /**
       * Store ID from store context middleware
       */
      storeId: string;

      /**
       * Customer ID from auth middleware
       * Only present when authenticated
       */
      customerId?: string;

      /**
       * Session ID from auth middleware
       * Only present when authenticated
       */
      sessionId?: string;

      /**
       * JWT payload from auth middleware
       * Only present when authenticated
       */
      jwtPayload?: JWTPayload;
    }
  }
}
