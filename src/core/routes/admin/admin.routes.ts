/**
 * Admin API Boundary
 *
 * Phase 0: Security boundary.
 *
 * Everything mounted here sits behind, in order:
 *   1. authorizationMiddleware  — verified JWT required            (401)
 *   2. requireRole(...)         — staff roles only                 (403)
 *   3. checkStoreOwnership      — no cross-store access            (403)
 *   4. requirePermission(...)   — per-route capability             (403)
 *   5. auditLog(...)            — admin mutations recorded
 *
 * This router is deny-by-default: a new sub-route inherits authentication,
 * role and store checks automatically and must opt *in* to a permission.
 *
 * Customer-facing APIs live under /api/v1 and must never be mounted here.
 */

import { Router, Request, Response } from 'express';
import {
  authorizationMiddleware,
  requireRole,
  requirePermission,
  checkStoreOwnership,
} from '../../middleware/authorization.middleware';
import { apiRateLimit } from '../../middleware/rate-limit.middleware';
import { auditLog } from '../../middleware/audit-log.middleware';
import { PaymentRepository, RefundRepository } from '../../repositories/payment.repositories';
import { OrderRepository, OrderLineRepository } from '../../repositories/order.repositories';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardController } from '../../controllers/dashboard.controller';
import { AdminOrderController } from '../../controllers/admin-order.controller';

/**
 * Build the admin router.
 * Mounted by the caller at /api/admin.
 */
export function createAdminRoutes(): Router {
  const router = Router({ mergeParams: true });

  // ---------------------------------------------------------------------------
  // Gate 1-2: every admin route requires a verified token and a staff role.
  // Applied at router level so no descendant can accidentally be left open.
  // ---------------------------------------------------------------------------
  router.use(apiRateLimit);
  router.use(authorizationMiddleware);
  router.use(requireRole('admin', 'support', 'system'));

  // ---------------------------------------------------------------------------
  // Dashboard (read-only)
  // ---------------------------------------------------------------------------
  const paymentRepo = new PaymentRepository();
  const refundRepo = new RefundRepository();
  const dashboardService = new DashboardService(paymentRepo, refundRepo);
  const dashboard = new DashboardController(dashboardService);

  const dashboardRouter = Router({ mergeParams: true });

  // Gate 3: store scoping for everything below.
  dashboardRouter.use(checkStoreOwnership);

  dashboardRouter.get(
    '/metrics',
    requirePermission('payment.view-all'),
    (req: Request, res: Response) => dashboard.getMetrics(req, res),
  );

  dashboardRouter.get(
    '/pending-refunds',
    requirePermission('refund.view-all'),
    (req: Request, res: Response) => dashboard.getPendingRefunds(req, res),
  );

  dashboardRouter.get(
    '/refund-statistics',
    requirePermission('refund.view-all'),
    (req: Request, res: Response) => dashboard.getRefundStatistics(req, res),
  );

  dashboardRouter.get(
    '/admin-actions',
    requirePermission('audit.view'),
    (req: Request, res: Response) => dashboard.getAdminActions(req, res),
  );

  dashboardRouter.get(
    '/charts/revenue',
    requirePermission('payment.view-all'),
    (req: Request, res: Response) => dashboard.getRevenueChart(req, res),
  );

  dashboardRouter.get(
    '/charts/refunds',
    requirePermission('refund.view-all'),
    (req: Request, res: Response) => dashboard.getRefundChart(req, res),
  );

  router.use('/stores/:storeId/dashboard', dashboardRouter);

  // ---------------------------------------------------------------------------
  // Orders (Phase 2)
  //
  // Reads require orders.view (admin + support). Mutations require a narrower
  // permission that support does not hold, and are recorded in the audit trail.
  // ---------------------------------------------------------------------------
  const orderRepo = new OrderRepository();
  const orderLineRepo = new OrderLineRepository();
  const orders = new AdminOrderController(orderRepo, orderLineRepo);

  const ordersRouter = Router({ mergeParams: true });
  ordersRouter.use(checkStoreOwnership);

  ordersRouter.get(
    '/',
    requirePermission('orders.view'),
    (req: Request, res: Response) => orders.list(req, res),
  );

  // Static segment before '/:orderId', otherwise 'status-counts' is captured as
  // an order id and this route becomes unreachable.
  ordersRouter.get(
    '/status-counts',
    requirePermission('orders.view'),
    (req: Request, res: Response) => orders.statusCounts(req, res),
  );

  ordersRouter.get(
    '/:orderId',
    requirePermission('orders.view'),
    (req: Request, res: Response) => orders.detail(req, res),
  );

  ordersRouter.post(
    '/:orderId/status',
    requirePermission('orders.update'),
    auditLog('order.status_change', 'orders'),
    (req: Request, res: Response) => orders.updateStatus(req, res),
  );

  ordersRouter.patch(
    '/:orderId/notes',
    requirePermission('orders.update'),
    auditLog('order.notes_update', 'orders'),
    (req: Request, res: Response) => orders.updateNotes(req, res),
  );

  router.use('/stores/:storeId/orders', ordersRouter);

  return router;
}
