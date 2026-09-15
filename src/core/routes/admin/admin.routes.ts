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
import { ProductRepository } from '../../repositories/product.repository';
import {
  CategoryRepository,
  VariantRepository,
  InventoryRepository,
  ProductImageRepository,
} from '../../repositories/catalog.repositories';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardController } from '../../controllers/dashboard.controller';
import { AdminOrderController } from '../../controllers/admin-order.controller';
import { AdminProductController } from '../../controllers/admin-product.controller';
import { AdminInventoryController } from '../../controllers/admin-inventory.controller';

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

  // ---------------------------------------------------------------------------
  // Products / catalogue (Phase 3)
  //
  // products.view is held by admin and support; products.update by admin only,
  // so support can confirm what a customer ordered without being able to change
  // pricing or availability.
  // ---------------------------------------------------------------------------
  const products = new AdminProductController(
    new ProductRepository(),
    new VariantRepository(),
    new InventoryRepository(),
    new ProductImageRepository(),
    new CategoryRepository(),
  );

  const productsRouter = Router({ mergeParams: true });
  productsRouter.use(checkStoreOwnership);

  productsRouter.get(
    '/',
    requirePermission('products.view'),
    (req: Request, res: Response) => products.list(req, res),
  );

  // Static segments must precede '/:productId', or they are captured as ids.
  productsRouter.get(
    '/status-counts',
    requirePermission('products.view'),
    (req: Request, res: Response) => products.statusCounts(req, res),
  );

  productsRouter.get(
    '/categories',
    requirePermission('products.view'),
    (req: Request, res: Response) => products.listCategories(req, res),
  );

  productsRouter.get(
    '/:productId',
    requirePermission('products.view'),
    (req: Request, res: Response) => products.detail(req, res),
  );

  productsRouter.post(
    '/:productId/status',
    requirePermission('products.update'),
    auditLog('product.status_change', 'products'),
    (req: Request, res: Response) => products.updateStatus(req, res),
  );

  router.use('/stores/:storeId/products', productsRouter);

  // ---------------------------------------------------------------------------
  // Inventory (Phase 4)
  //
  // inventory.view is held by admin and support; inventory.adjust by admin
  // only. Adjustments change sellable stock, so every one is audited.
  // ---------------------------------------------------------------------------
  const inventoryRepo = new InventoryRepository();
  const inventory = new AdminInventoryController(inventoryRepo);

  const inventoryRouter = Router({ mergeParams: true });
  inventoryRouter.use(checkStoreOwnership);

  inventoryRouter.get(
    '/',
    requirePermission('inventory.view'),
    (req: Request, res: Response) => inventory.list(req, res),
  );

  // Static segment before any ':variantId' route.
  inventoryRouter.get(
    '/counts',
    requirePermission('inventory.view'),
    (req: Request, res: Response) => inventory.counts(req, res),
  );

  inventoryRouter.post(
    '/:variantId/adjust',
    requirePermission('inventory.adjust'),
    auditLog('inventory.adjust', 'inventory'),
    (req: Request, res: Response) => inventory.adjust(req, res),
  );

  inventoryRouter.patch(
    '/:variantId/reorder-policy',
    requirePermission('inventory.adjust'),
    auditLog('inventory.reorder_policy', 'inventory'),
    (req: Request, res: Response) => inventory.setReorderPolicy(req, res),
  );

  router.use('/stores/:storeId/inventory', inventoryRouter);

  return router;
}
