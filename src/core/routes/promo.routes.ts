/**
 * Promotions & Discounts Routes
 * API endpoints for promo codes and discount management
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { Router } from 'express';
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
  router.get('/promo-codes/active', (req, res) => promoController.listActivePromos(req, res));

  // Get expiring promo codes
  router.get('/promo-codes/expiring', (req, res) => promoController.getExpiringPromos(req, res));

  // Create promo code
  router.post('/promo-codes', (req, res) => promoController.createPromoCode(req, res));

  // Get promo code
  router.get('/promo-codes/:codeId', (req, res) => promoController.getPromoCode(req, res));

  // Update promo code
  router.put('/promo-codes/:codeId', (req, res) => promoController.updatePromoCode(req, res));

  // Deactivate promo code
  router.post('/promo-codes/:codeId/deactivate', (req, res) =>
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
  router.get('/orders/:orderId/discounts', (req, res) =>
    discountController.getOrderDiscounts(req, res)
  );

  /**
   * Analytics Routes
   * Base: /stores/:storeId/analytics
   */

  // Get promo analytics
  router.get('/analytics/promos', (req, res) => promoController.getPromoAnalytics(req, res));

  return router;
}
