/**
 * Promotions & Discounts Integration Tests
 * Testing promo code validation, discount calculation, and application
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromoCodeEntity } from '../entities/promo-code.entity';
import { DiscountApplicationEntity } from '../entities/discount-application.entity';
import { PromoCodeRepository, DiscountApplicationRepository } from '../repositories/promo.repositories';
import { PromoCodeService, DiscountService } from '../services/promo.service';

describe('Promotions & Discounts Integration Tests', () => {
  let promoRepo: PromoCodeRepository;
  let discountRepo: DiscountApplicationRepository;
  let promoService: PromoCodeService;
  let discountService: DiscountService;

  const storeId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    promoRepo = new PromoCodeRepository();
    discountRepo = new DiscountApplicationRepository();
    promoService = new PromoCodeService(promoRepo, discountRepo);
    discountService = new DiscountService(promoRepo, discountRepo);
  });

  describe('Promo Code Creation', () => {
    it('should create a percentage discount promo', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'SAVE20',
        discount_type: 'percentage',
        discount_value: 20,
        description: '20% off all items',
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      expect(promo).toBeDefined();
      expect(promo.code).toBe('SAVE20');
      expect(promo.discount_type).toBe('percentage');
      expect(promo.discount_value).toBe(20);
      expect(promo.status).toBe('active');
    });

    it('should create a fixed amount discount promo', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'SAVE10',
        discount_type: 'fixed',
        discount_value: 10,
        description: '$10 off',
        start_date: new Date(),
      });

      expect(promo.discount_type).toBe('fixed');
      expect(promo.discount_value).toBe(10);
    });

    it('should prevent duplicate codes per store', async () => {
      await promoService.createPromoCode(storeId, {
        code: 'DUPLICATE',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date(),
      });

      expect(
        promoService.createPromoCode(storeId, {
          code: 'DUPLICATE',
          discount_type: 'percentage',
          discount_value: 15,
          start_date: new Date(),
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('Promo Code Validation', () => {
    it('should validate active promo code', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'VALID20',
        discount_type: 'percentage',
        discount_value: 20,
        start_date: new Date(),
      });

      const validation = await promoService.validateCode(storeId, 'VALID20', 100);

      expect(validation.valid).toBe(true);
      expect(validation.promoCode).toBeDefined();
      expect(validation.promoCode?.id).toBe(promo.id);
    });

    it('should reject non-existent code', async () => {
      const validation = await promoService.validateCode(storeId, 'NOTFOUND', 100);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('not found');
    });

    it('should enforce minimum purchase requirement', async () => {
      await promoService.createPromoCode(storeId, {
        code: 'MINPURCHASE',
        discount_type: 'percentage',
        discount_value: 10,
        min_purchase: 100,
        start_date: new Date(),
      });

      const validation = await promoService.validateCode(storeId, 'MINPURCHASE', 50);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Minimum purchase');
    });

    it('should respect usage limits', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'LIMITED',
        discount_type: 'percentage',
        discount_value: 10,
        usage_limit: 1,
        start_date: new Date(),
      });

      // First use should be valid
      const firstValidation = await promoService.validateCode(storeId, 'LIMITED', 100);
      expect(firstValidation.valid).toBe(true);

      // Use the code (increment usage)
      await promoRepo.incrementUsage(promo.id, storeId);

      // Second use should fail
      const secondValidation = await promoService.validateCode(storeId, 'LIMITED', 100);
      expect(secondValidation.valid).toBe(false);
    });
  });

  describe('Discount Calculation', () => {
    it('should calculate percentage discount', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'PERCENT',
        discount_type: 'percentage',
        discount_value: 20,
        start_date: new Date(),
      });

      const discount = await discountService.calculateDiscount(promo, 100);

      expect(discount.discountAmount).toBe(20);
      expect(discount.discountType).toBe('percentage');
    });

    it('should calculate fixed discount', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'FIXED',
        discount_type: 'fixed',
        discount_value: 15,
        start_date: new Date(),
      });

      const discount = await discountService.calculateDiscount(promo, 100);

      expect(discount.discountAmount).toBe(15);
    });

    it('should apply max discount cap', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'CAPPED',
        discount_type: 'percentage',
        discount_value: 50,
        max_discount: 20,
        start_date: new Date(),
      });

      const discount = await discountService.calculateDiscount(promo, 100);

      expect(discount.discountAmount).toBe(20); // capped at max_discount
    });
  });

  describe('Discount Application', () => {
    it('should apply discount to cart', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'APPLY',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date(),
      });

      const cartId = '550e8400-e29b-41d4-a716-446655440200';
      const application = await discountService.applyDiscount(
        storeId,
        promo,
        10,
        cartId
      );

      expect(application).toBeDefined();
      expect(application.cart_id).toBe(cartId);
      expect(application.discount_amount).toBe(10);
    });

    it('should retrieve applied discounts', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'RETRIEVE',
        discount_type: 'fixed',
        discount_value: 5,
        start_date: new Date(),
      });

      const cartId = '550e8400-e29b-41d4-a716-446655440201';
      await discountService.applyDiscount(storeId, promo, 5, cartId);

      const applied = await discountService.getAppliedDiscounts(storeId, cartId);

      expect(applied.length).toBeGreaterThan(0);
      expect(applied[0].discount_amount).toBe(5);
    });

    it('should calculate total discount', async () => {
      const promo1 = await promoService.createPromoCode(storeId, {
        code: 'TOTAL1',
        discount_type: 'fixed',
        discount_value: 5,
        start_date: new Date(),
      });

      const promo2 = await promoService.createPromoCode(storeId, {
        code: 'TOTAL2',
        discount_type: 'fixed',
        discount_value: 10,
        start_date: new Date(),
      });

      const cartId = '550e8400-e29b-41d4-a716-446655440202';
      await discountService.applyDiscount(storeId, promo1, 5, cartId);
      await discountService.applyDiscount(storeId, promo2, 10, cartId);

      const total = await discountService.getTotalDiscount(storeId, cartId);

      expect(total).toBe(15);
    });
  });

  describe('Promo Code Management', () => {
    it('should update promo code', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'UPDATE',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date(),
      });

      const updated = await promoService.updatePromoCode(storeId, promo.id, {
        discount_value: 15,
        description: 'Updated to 15%',
      });

      expect(updated.discount_value).toBe(15);
      expect(updated.description).toBe('Updated to 15%');
    });

    it('should deactivate promo code', async () => {
      const promo = await promoService.createPromoCode(storeId, {
        code: 'DEACTIVATE',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date(),
      });

      const deactivated = await promoService.deactivatePromoCode(storeId, promo.id);

      expect(deactivated.status).toBe('inactive');
    });

    it('should get active promo codes', async () => {
      await promoService.createPromoCode(storeId, {
        code: 'ACTIVE1',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date(),
      });

      const active = await promoService.getActivePromoCodes(storeId);

      expect(active.length).toBeGreaterThan(0);
      expect(active.every((p) => p.status === 'active')).toBe(true);
    });
  });

  describe('Store Isolation', () => {
    it('should isolate promo codes by store', async () => {
      const storeId2 = '550e8400-e29b-41d4-a716-446655440002';

      const promo1 = await promoService.createPromoCode(storeId, {
        code: 'ISOLATE',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: new Date(),
      });

      const promo2 = await promoService.createPromoCode(storeId2, {
        code: 'ISOLATE',
        discount_type: 'percentage',
        discount_value: 20,
        start_date: new Date(),
      });

      expect(promo1.store_id).toBe(storeId);
      expect(promo2.store_id).toBe(storeId2);
      expect(promo1.discount_value).not.toBe(promo2.discount_value);
    });
  });
});
