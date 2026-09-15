/**
 * Staff guard for administrative operations on customer-prefixed routers.
 *
 * Phase 0: Security boundary.
 *
 * Background: the catalog and order routers are mounted under /api/v1 and mix
 * genuinely public storefront reads (browse products, view a category) with
 * administrative operations that were left unauthenticated — creating and
 * deleting products, editing prices, marking orders paid, reading revenue
 * analytics and low-stock levels.
 *
 * Splitting those routers into /api/v1 and /api/admin halves is the right
 * end-state and is planned, but it is a larger refactor than closing the hole
 * requires. This guard closes it now by requiring a verified staff token on the
 * administrative operations, leaving public reads public.
 *
 * Composition: authenticate (401) -> staff role (403).
 */

import { Request, Response, NextFunction } from 'express';
import { authorizationMiddleware, requireRole } from './authorization.middleware';

const staffRoleGuard = requireRole('admin', 'support', 'system');

/**
 * Require a verified staff token.
 *
 * Responds 401 when the caller is unauthenticated or the token is invalid,
 * 403 when the caller is authenticated but not staff.
 */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  authorizationMiddleware(req, res, () => {
    staffRoleGuard(req, res, next);
  });
}
