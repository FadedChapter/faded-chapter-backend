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
import { AdminCustomerController } from '../../controllers/admin-customer.controller';
import { AdminPaymentController } from '../../controllers/admin-payment.controller';
import { AdminAnalyticsController } from '../../controllers/admin-analytics.controller';
import { AdminDiscountController } from '../../controllers/admin-discount.controller';
import { AdminShippingController } from '../../controllers/admin-shipping.controller';
import { AdminAlertsController } from '../../controllers/admin-alerts.controller';
import { AlertsService } from '../../services/alerts.service';
import { AnalyticsService } from '../../services/analytics.service';
import { CustomerRepository } from '../../repositories/customer.repository';

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

  // ---------------------------------------------------------------------------
  // Customers (Phase 5)
  //
  // customers.view is held by admin and support; customers.update by admin
  // only. Status changes are decisions about a person's access to the store, so
  // every one is audited.
  // ---------------------------------------------------------------------------
  const customers = new AdminCustomerController(new CustomerRepository(), orderRepo);

  const customersRouter = Router({ mergeParams: true });
  customersRouter.use(checkStoreOwnership);

  customersRouter.get(
    '/',
    requirePermission('customers.view'),
    (req: Request, res: Response) => customers.list(req, res),
  );

  // Static segment before ':customerId'.
  customersRouter.get(
    '/status-counts',
    requirePermission('customers.view'),
    (req: Request, res: Response) => customers.statusCounts(req, res),
  );

  customersRouter.get(
    '/:customerId',
    requirePermission('customers.view'),
    (req: Request, res: Response) => customers.detail(req, res),
  );

  customersRouter.post(
    '/:customerId/status',
    requirePermission('customers.update'),
    auditLog('customer.status_change', 'customers'),
    (req: Request, res: Response) => customers.updateStatus(req, res),
  );

  router.use('/stores/:storeId/customers', customersRouter);

  // ---------------------------------------------------------------------------
  // Payments (Phase 6)
  //
  // Reading transactions requires payment.view-all (admin + support, since
  // support answers "did my payment go through"). Approving or rejecting a
  // refund moves money and requires refund.approve / refund.reject, which only
  // admin holds. Both decisions are audited.
  // ---------------------------------------------------------------------------
  const paymentsAdmin = new AdminPaymentController(paymentRepo, refundRepo);

  const paymentsRouter = Router({ mergeParams: true });
  paymentsRouter.use(checkStoreOwnership);

  paymentsRouter.get(
    '/',
    requirePermission('payment.view-all'),
    (req: Request, res: Response) => paymentsAdmin.listTransactions(req, res),
  );

  // Static segments before ':paymentId', or they are captured as ids.
  paymentsRouter.get(
    '/summary',
    requirePermission('payment.view-all'),
    (req: Request, res: Response) => paymentsAdmin.summary(req, res),
  );

  paymentsRouter.get(
    '/refunds/pending',
    requirePermission('refund.view-all'),
    (req: Request, res: Response) => paymentsAdmin.pendingRefunds(req, res),
  );

  paymentsRouter.post(
    '/refunds/:refundId/approve',
    requirePermission('refund.approve'),
    auditLog('refund.approve', 'refunds'),
    (req: Request, res: Response) => paymentsAdmin.approveRefund(req, res),
  );

  paymentsRouter.post(
    '/refunds/:refundId/reject',
    requirePermission('refund.reject'),
    auditLog('refund.reject', 'refunds'),
    (req: Request, res: Response) => paymentsAdmin.rejectRefund(req, res),
  );

  paymentsRouter.get(
    '/:paymentId',
    requirePermission('payment.view-all'),
    (req: Request, res: Response) => paymentsAdmin.detail(req, res),
  );

  router.use('/stores/:storeId/payments', paymentsRouter);

  // ---------------------------------------------------------------------------
  // Analytics (Phase 7)
  //
  // analytics.view is admin-only. Exports are logged: they move data out of the
  // audited console onto someone's laptop, which is worth recording even though
  // nothing is mutated.
  // ---------------------------------------------------------------------------
  const analytics = new AdminAnalyticsController(new AnalyticsService());

  const analyticsRouter = Router({ mergeParams: true });
  analyticsRouter.use(checkStoreOwnership);

  analyticsRouter.get(
    '/',
    requirePermission('analytics.view'),
    (req: Request, res: Response) => analytics.overview(req, res),
  );

  analyticsRouter.get(
    '/export',
    requirePermission('analytics.view'),
    (req: Request, res: Response) => analytics.exportCsv(req, res),
  );

  router.use('/stores/:storeId/analytics', analyticsRouter);

  // ---------------------------------------------------------------------------
  // Discounts (Phase 8)
  //
  // discounts.view is held by admin and support, since support is asked why a
  // code was rejected. discounts.manage is admin-only: a promo code is
  // spendable value, and issuing one is closer to issuing credit than to
  // editing a product. Every mutation is audited.
  // ---------------------------------------------------------------------------
  const discounts = new AdminDiscountController();

  const discountsRouter = Router({ mergeParams: true });
  discountsRouter.use(checkStoreOwnership);

  discountsRouter.get(
    '/',
    requirePermission('discounts.view'),
    (req: Request, res: Response) => discounts.list(req, res),
  );

  // Static segment before any ':discountId' route.
  discountsRouter.get(
    '/redemptions',
    requirePermission('discounts.view'),
    (req: Request, res: Response) => discounts.redemptions(req, res),
  );

  discountsRouter.post(
    '/',
    requirePermission('discounts.manage'),
    auditLog('discount.create', 'promo_codes'),
    (req: Request, res: Response) => discounts.create(req, res),
  );

  discountsRouter.post(
    '/:discountId/status',
    requirePermission('discounts.manage'),
    auditLog('discount.status_change', 'promo_codes'),
    (req: Request, res: Response) => discounts.updateStatus(req, res),
  );

  router.use('/stores/:storeId/discounts', discountsRouter);

  // ---------------------------------------------------------------------------
  // Shipping (Phase 9)
  //
  // shipping.view is held by admin and support, since support is asked when an
  // order will arrive. shipping.manage is admin-only: delivery pricing is
  // margin. Every mutation is audited.
  // ---------------------------------------------------------------------------
  const shipping = new AdminShippingController();

  const shippingRouter = Router({ mergeParams: true });
  shippingRouter.use(checkStoreOwnership);

  shippingRouter.get(
    '/',
    requirePermission('shipping.view'),
    (req: Request, res: Response) => shipping.list(req, res),
  );

  shippingRouter.get(
    '/:methodId/rates',
    requirePermission('shipping.view'),
    (req: Request, res: Response) => shipping.rateCard(req, res),
  );

  shippingRouter.post(
    '/',
    requirePermission('shipping.manage'),
    auditLog('shipping.method_create', 'shipping_methods'),
    (req: Request, res: Response) => shipping.create(req, res),
  );

  shippingRouter.post(
    '/:methodId/availability',
    requirePermission('shipping.manage'),
    auditLog('shipping.availability_change', 'shipping_methods'),
    (req: Request, res: Response) => shipping.setAvailability(req, res),
  );

  router.use('/stores/:storeId/shipping', shippingRouter);

  // ---------------------------------------------------------------------------
  // Alerts (Phase 10)
  //
  // alerts.view is held by admin and support. alerts.manage is admin-only:
  // silencing a rule stops the whole team seeing the condition, which is a
  // different weight of decision from reading it.
  // ---------------------------------------------------------------------------
  const alerts = new AdminAlertsController(new AlertsService());

  const alertsRouter = Router({ mergeParams: true });
  alertsRouter.use(checkStoreOwnership);

  alertsRouter.get(
    '/',
    requirePermission('alerts.view'),
    (req: Request, res: Response) => alerts.overview(req, res),
  );

  alertsRouter.patch(
    '/rules/:ruleKey',
    requirePermission('alerts.manage'),
    auditLog('alert.rule_change', 'notification_rules'),
    (req: Request, res: Response) => alerts.updateRule(req, res),
  );

  router.use('/stores/:storeId/alerts', alertsRouter);

  return router;
}
