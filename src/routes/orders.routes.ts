/**
 * Orders Routes
 *
 * Phase 3F.4 — Customer Order Retrieval (PLANNED)
 * - GET /api/orders — Get customer's orders (authenticated)
 * - GET /api/orders/:id — Get order details (authenticated)
 *
 * Security:
 * - Requires authentication (session cookie)
 * - Returns only orders belonging to authenticated customer
 * - Shopify access token stored server-side only (Phase 3F.3)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireSession } from '../core/session/middleware/session.middleware.js';

/**
 * Create orders routes.
 * Mounted at /api/orders
 */
export function createOrdersRoutes(): Router {
  const router = Router();

  /**
   * GET /api/orders
   * Get authenticated customer's orders (PLANNED: Phase 3F.4)
   *
   * For now: Returns 501 Not Implemented
   * Future: Will fetch orders from Shopify via server-side OAuth token
   *
   * Response:
   * - 501: Not implemented yet
   */
  router.get('/', requireSession, async (_req: Request, res: Response) => {
    res.status(501).json({
      ok: false,
      error: { code: 'notImplemented', message: 'Order retrieval not yet implemented (Phase 3F.4)' },
    });
  });

  /**
   * GET /api/orders/:id
   * Get specific order details (PLANNED: Phase 3F.4)
   *
   * Response:
   * - 501: Not implemented yet
   */
  router.get('/:id', requireSession, async (_req: Request, res: Response) => {
    res.status(501).json({
      ok: false,
      error: { code: 'notImplemented', message: 'Order retrieval not yet implemented (Phase 3F.4)' },
    });
  });

  return router;
}
