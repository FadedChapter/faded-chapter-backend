/**
 * Core Router
 * Combines all core domain routes
 *
 * Phase 3: API Layer
 * Phase 4: Catalog Domain
 * Phase 5: Order Management Domain
 * Phase 6: Cart & Checkout Domain
 * Phase 7: Promotions & Discounts Domain
 * Phase 8: Shipping Integration
 * Phase 9: Payment Processing
 */

import { Express, Router } from 'express';
import { createAuthRoutes } from './auth.routes';
import { createCustomerRoutes } from './customer.routes';
import { createAddressRoutes } from './address.routes';
import { createPreferencesRoutes } from './preferences.routes';
import { createCatalogRoutes } from './catalog.routes';
import { createOrderRoutes } from './order.routes';
import { createCartRoutes } from './cart.routes';
import { createPromoRoutes } from './promo.routes';
import { createShippingRoutes } from './shipping.routes';
import { createPaymentRoutes } from './payment.routes';
import { createWebhookRoutes } from './webhook.routes';
import { createAdminRoutes } from './admin/admin.routes';

/**
 * Register all core domain routes
 * Called from main app setup
 *
 * Usage:
 * import { registerCoreRoutes } from './core/routes';
 * registerCoreRoutes(app, services);
 */
export function registerCoreRoutes(
  app: Express,
  services?: {
    payment?: any;
    refund?: any;
    webhook?: any;
    razorpay?: any;
  }
): void {
  const router = Router();

  // Mount all sub-routers
  router.use('/auth', createAuthRoutes());
  router.use('/customers', createCustomerRoutes());
  router.use('/addresses', createAddressRoutes());
  router.use('/preferences', createPreferencesRoutes());
  router.use('/stores/:storeId', createCatalogRoutes());
  router.use('/stores/:storeId', createOrderRoutes());
  router.use('/stores/:storeId', createCartRoutes());
  router.use('/stores/:storeId', createPromoRoutes());
  router.use('/stores/:storeId/shipping', createShippingRoutes());

  // Payment routes.
  // Previously gated on `if (services?.payment && services?.refund)` while the
  // sole caller passed no services at all — so these silently never mounted.
  // Absence is now explicit in the startup log rather than invisible.
  if (services?.payment && services?.refund) {
    router.use('/stores/:storeId/payments', createPaymentRoutes(services.payment, services.refund));
    // NOTE: createSecurePaymentRoutes is intentionally NOT mounted here.
    // Two blockers, both tracked as remaining Phase 0 work:
    //   1. It mixes customer endpoints (POST /intents) with admin-only ones
    //      (refund approve/reject, audit trail). The admin half belongs under
    //      /api/admin, so mounting it wholesale on /api/v1 would put admin
    //      operations back on the customer prefix.
    //   2. payment-secure.controller.ts reads AuditLogEntity.actor_email /
    //      .resource_type / .resource_id, none of which exist on that entity.
    // Mounting it as-is would surface a broken endpoint, so it stays unmounted
    // until it is split and the controller is reconciled with the entity.
  } else {
    console.warn(
      '[routes] Payment routes NOT mounted: registerCoreRoutes() received no payment/refund services.',
    );
  }

  // Webhook routes (optional, requires services)
  if (services?.webhook && services?.razorpay) {
    router.use('/stores/:storeId/webhooks', createWebhookRoutes(services.webhook, services.razorpay));
  } else {
    console.warn(
      '[routes] Webhook routes NOT mounted: registerCoreRoutes() received no webhook/razorpay services.',
    );
  }

  // Customer-facing API.
  app.use('/api/v1', router);

  // ---------------------------------------------------------------------------
  // Admin API — separate prefix, separate authorization boundary.
  //
  // Dashboard routes used to be mounted on /api/v1 with NO authentication,
  // exposing store revenue and the admin audit trail to anonymous callers.
  // They now live only behind /api/admin. Do not re-add them above.
  // ---------------------------------------------------------------------------
  app.use('/api/admin', createAdminRoutes());
}

export {
  createAuthRoutes,
  createCustomerRoutes,
  createAddressRoutes,
  createPreferencesRoutes,
  createCatalogRoutes,
  createOrderRoutes,
  createCartRoutes,
  createPromoRoutes,
  createShippingRoutes,
  createPaymentRoutes,
  createWebhookRoutes
};
