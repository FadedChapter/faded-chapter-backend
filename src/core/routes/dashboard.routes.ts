/**
 * DEPRECATED — DO NOT MOUNT.
 *
 * These dashboard routes were previously mounted on /api/v1 with no
 * authentication, exposing store revenue and the admin audit trail to any
 * anonymous caller.
 *
 * They now live behind the admin authorization boundary:
 *   src/core/routes/admin/admin.routes.ts  →  /api/admin/stores/:storeId/dashboard
 *
 * where they sit behind authorizationMiddleware + requireRole + checkStoreOwnership
 * + requirePermission.
 *
 * This factory is retained only so that any stale import fails loudly and
 * immediately at startup rather than silently re-opening the hole.
 */

import { Router } from 'express';

export function createDashboardRoutes(): Router {
  throw new Error(
    'createDashboardRoutes() is deprecated and must not be mounted: it has no ' +
      'authentication. Use createAdminRoutes() from ./admin/admin.routes instead, ' +
      'which serves these endpoints under /api/admin behind role and permission checks.',
  );
}
