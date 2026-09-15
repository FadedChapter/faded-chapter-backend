/**
 * Promotions & Discounts Routes
 * API endpoints for promo codes and discount management
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { Router } from 'express';
// Phase 8: every promo route was unauthenticated, including code creation.
// Anyone could mint themselves a 100%-off code, rewrite an existing code's
// value, deactivate a live campaign, or enumerate all active codes. It was
// latent only because promo_codes did not exist as a table; creating it
// without this guard would have made it live.
import { requireStaff } from '../middleware/require-staff.middleware';
import { PromoCodeController, DiscountController } from '../controllers/promo.controller';
import { PromoCodeService, DiscountService } from '../services/promo.service';
import { PromoCodeRepository, DiscountApplicationRepository } from '../repositories/promo.repositories';

/**
 * Create promo routes
 * Called from core routes registry
 */
export function createPromoRoutes(): Router {
  const router = Router({ mergeParams: true });

  // Initialize repositories and services
  const promoRepo = new PromoCodeRepository();
  const discountRepo = new DiscountApplicationRepository();

  const promoService = new PromoCodeService(promoRepo, discountRepo);
  const discountService = new DiscountService(promoRepo, discountRepo);

  const promoController = new PromoCodeController(promoService, discountService);
  const discountController = new DiscountController(discountService);

  /**
   * Promo Code Routes
   * Base: /stores/:storeId/promo-codes
   */

  // List active promo codes
  // Staff-only, despite sounding like storefront data. This returns every
  // active code together with its discount value, so exposing it publicly means
  // any visitor can enumerate and redeem every campaign — which defeats
  // influencer codes, email-only offers and per-segment usage limits, since a
  // code's whole value is that not everyone has it.
  //
  // The storefront's legitimate need is POST /validate-code: check the code a
  // customer actually typed. That stays public.
  router.get('/promo-codes/active', requireStaff, (req, res) => promoController.listActivePromos(req, res));

  // Get expiring promo codes
  router.get('/promo-codes/expiring', requireStaff, (req, res) => promoController.getExpiringPromos(req, res));

  // Create promo code
  router.post('/promo-codes', requireStaff, (req, res) => promoController.createPromoCode(req, res));

  // Get promo code
  router.get('/promo-codes/:codeId', requireStaff, (req, res) => promoController.getPromoCode(req, res));

  // Update promo code
  router.put('/promo-codes/:codeId', requireStaff, (req, res) => promoController.updatePromoCode(req, res));

  // Deactivate promo code
  router.post('/promo-codes/:codeId/deactivate', requireStaff, (req, res) =>
    promoController.deactivatePromoCode(req, res)
  );

  /**
   * Validation Routes
   * Base: /stores/:storeId/validate
   */

  // Validate promo code
  router.post('/validate-code', (req, res) => promoController.validatePromoCode(req, res));

  /**
   * Discount Routes
   * Base: /stores/:storeId/discounts
   */

  // Get cart discounts
  router.get('/carts/:cartId/discounts', (req, res) => discountController.getCartDiscounts(req, res));

  // Get order discounts
  router.get('/orders/:orderId/discounts', requireStaff, (req, res) =>
    discountController.getOrderDiscounts(req, res)
  );

  /**
   * Analytics Routes
   * Base: /stores/:storeId/analytics
   */

  // Get promo analytics
  router.get('/analytics/promos', requireStaff, (req, res) => promoController.getPromoAnalytics(req, res));

  return router;
}
