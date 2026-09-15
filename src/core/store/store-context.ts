/**
 * Store Context Management
 * Enforces store isolation across all requests
 *
 * Core v2.1 Requirement: Every record belongs to exactly one store
 * Store ownership is immutable and enforced at the application layer
 *
 * Phase 0: Infrastructure setup
 */

import { Request, Response, NextFunction } from 'express';
import { logWarn } from '../logging/logger';
import { getConfig } from '../config/env';

/**
 * Store context attached to each request
 */
export interface StoreContext {
  storeId: string;
  // Future: store metadata like name, currency, timezone
}

/**
 * Extend Express Request to include store context
 */
declare global {
  namespace Express {
    interface Request {
      storeContext?: StoreContext;
    }
  }
}

/**
 * Middleware: Enforce store context on every request
 *
 * In Phase 1, this will:
 * - Extract store_id from the JWT token (from store_members table)
 * - Validate that the customer belongs to this store
 * - Attach the store context to the request
 *
 * For now (Phase 0), uses a default store for development
 */
export function createStoreContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Phase 0: Use default store from env
      // Phase 1: Extract from authenticated user
      const config = getConfig();
      const storeId = req.headers['x-store-id'] as string || config.DEFAULT_STORE_ID;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(storeId)) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_STORE_ID',
            message: 'Store ID must be a valid UUID',
          },
        });
      }

      // Attach store context to request
      req.storeContext = { storeId };

      // Log for debugging (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[StoreContext] ${req.method} ${req.path} → Store: ${storeId}`);
      }

      next();
    } catch (error) {
      logWarn('Failed to create store context', { error: error instanceof Error ? error.message : error });
      return res.status(500).json({
        ok: false,
        error: {
          code: 'STORE_CONTEXT_ERROR',
          message: 'Failed to create store context',
        },
      });
    }
  };
}

/**
 * Get store context from request
 * Throws if store context is not attached
 */
export function getStoreContext(req: Request): StoreContext {
  if (!req.storeContext) {
    throw new Error('Store context not available. Ensure StoreContextMiddleware is applied.');
  }
  return req.storeContext;
}

/**
 * Helper to get store ID from request
 */
export function getStoreId(req: Request): string {
  return getStoreContext(req).storeId;
}

/**
 * Verify that a record belongs to the request's store
 * Used in service/controller methods to prevent cross-store access
 */
export function verifyStoreOwnership(recordStoreId: string, requestStoreId: string): boolean {
  return recordStoreId === requestStoreId;
}
