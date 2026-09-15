/**
 * Promotions & Discounts Services
 * Promo code management and discount calculation
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { PromoCodeEntity } from '../entities/promo-code.entity';
import { DiscountApplicationEntity } from '../entities/discount-application.entity';
import { PromoCodeRepository, DiscountApplicationRepository } from '../repositories/promo.repositories';
import {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  ValidatePromoCodeDto,
  ApplyDiscountDto,
} from '../dtos/promo.dto';

/**
 * Promo Code Service
 */
export class PromoCodeService {
  constructor(
    private promoRepo: PromoCodeRepository,
    private discountRepo: DiscountApplicationRepository
  ) {}

  async createPromoCode(storeId: string, dto: CreatePromoCodeDto): Promise<PromoCodeEntity> {
    // Check code uniqueness
    const existing = await this.promoRepo.findByCode(dto.code, storeId);
    if (existing) {
      throw new Error(`Promo code "${dto.code}" already exists`);
    }

    const promo = new PromoCodeEntity();
    promo.id = crypto.randomUUID();
    promo.store_id = storeId;
    promo.code = dto.code.toUpperCase();
    promo.discount_type = dto.discount_type;
    promo.discount_value = dto.discount_value;
    promo.description = dto.description;
    promo.status = 'active';
    promo.usage_limit = dto.usage_limit;
    promo.usage_count = 0;
    promo.min_purchase = dto.min_purchase || 0;
    promo.max_discount = dto.max_discount;
    promo.applicable_products = dto.applicable_products;
    promo.applicable_categories = dto.applicable_categories;
    promo.metadata = dto.metadata || {};
    promo.start_date = dto.start_date;
    promo.end_date = dto.end_date;
    promo.stackable = dto.stackable !== false;
    promo.created_at = new Date();
    promo.updated_at = new Date();

    return this.promoRepo.save(promo);
  }

  async getPromoCode(storeId: string, codeId: string): Promise<PromoCodeEntity> {
    return this.promoRepo.findByIdOrFail(codeId, storeId);
  }

  async findByCode(storeId: string, code: string): Promise<PromoCodeEntity | null> {
    return this.promoRepo.findByCode(code, storeId);
  }

  async updatePromoCode(
    storeId: string,
    codeId: string,
    dto: UpdatePromoCodeDto
  ): Promise<PromoCodeEntity> {
    const promo = await this.promoRepo.findByIdOrFail(codeId, storeId);

    if (dto.code && dto.code !== promo.code) {
      const existing = await this.promoRepo.findByCode(dto.code, storeId);
      if (existing && existing.id !== codeId) {
        throw new Error(`Promo code "${dto.code}" already exists`);
      }
      promo.code = dto.code.toUpperCase();
    }

    if (dto.description !== undefined) promo.description = dto.description;
    if (dto.status) promo.status = dto.status;
    if (dto.usage_limit !== undefined) promo.usage_limit = dto.usage_limit;
    if (dto.min_purchase !== undefined) promo.min_purchase = dto.min_purchase;
    if (dto.max_discount !== undefined) promo.max_discount = dto.max_discount;
    if (dto.applicable_products !== undefined) promo.applicable_products = dto.applicable_products;
    if (dto.applicable_categories !== undefined)
      promo.applicable_categories = dto.applicable_categories;
    if (dto.end_date !== undefined) promo.end_date = dto.end_date;
    if (dto.stackable !== undefined) promo.stackable = dto.stackable;
    if (dto.metadata) promo.metadata = { ...promo.metadata, ...dto.metadata };

    promo.updated_at = new Date();

    return this.promoRepo.save(promo);
  }

  async validateCode(
    storeId: string,
    code: string,
    cartSubtotal: number = 0
  ): Promise<{
    valid: boolean;
    error?: string;
    promo?: PromoCodeEntity;
  }> {
    return this.promoRepo.validateCode(code, storeId, cartSubtotal);
  }

  async getActivePromoCodes(storeId: string): Promise<PromoCodeEntity[]> {
    return this.promoRepo.findActive(storeId);
  }

  async getExpiringPromoCodes(storeId: string, daysUntilExpiry: number = 7): Promise<PromoCodeEntity[]> {
    return this.promoRepo.getExpiring(storeId, daysUntilExpiry);
  }

  async deactivatePromoCode(storeId: string, codeId: string): Promise<PromoCodeEntity> {
    return this.promoRepo.updateStatus(codeId, storeId, 'inactive');
  }
}

/**
 * Discount Service
 */
export class DiscountService {
  constructor(
    private promoRepo: PromoCodeRepository,
    private discountRepo: DiscountApplicationRepository
  ) {}

  async calculateDiscount(
    promoCode: PromoCodeEntity,
    cartSubtotal: number,
    applicableAmount: number = cartSubtotal
  ): Promise<{
    discountAmount: number;
    discountType: string;
    error?: string;
  }> {
    if (applicableAmount < promoCode.min_purchase) {
      return {
        discountAmount: 0,
        discountType: promoCode.discount_type,
        error: `Minimum purchase of $${promoCode.min_purchase} required`,
      };
    }

    let discountAmount = 0;

    switch (promoCode.discount_type) {
      case 'percentage':
        discountAmount = (applicableAmount * promoCode.discount_value) / 100;
        break;

      case 'fixed':
        discountAmount = promoCode.discount_value;
        break;

      case 'free_shipping':
        // Free shipping discount handled separately
        discountAmount = promoCode.discount_value;
        break;

      case 'bogo':
        // Buy One Get One - discount is typically the price of cheapest item
        discountAmount = promoCode.discount_value;
        break;

      case 'tiered':
        // Tiered discounts based on purchase amount
        if (applicableAmount >= promoCode.discount_value) {
          // Assume discount_value holds the threshold and discount_percentage holds the discount
          discountAmount = (applicableAmount * (promoCode.max_discount || 10)) / 100;
        }
        break;

      default:
        return { discountAmount: 0, discountType: promoCode.discount_type };
    }

    // Apply max discount cap if set
    if (promoCode.max_discount && discountAmount > promoCode.max_discount) {
      discountAmount = promoCode.max_discount;
    }

    return {
      discountAmount,
      discountType: promoCode.discount_type,
    };
  }

  async applyDiscount(
    storeId: string,
    promoCode: PromoCodeEntity,
    discountAmount: number,
    cartId?: string,
    orderId?: string
  ): Promise<DiscountApplicationEntity> {
    const application = new DiscountApplicationEntity();
    application.id = crypto.randomUUID();
    application.store_id = storeId;
    application.promo_code_id = promoCode.id;
    application.cart_id = cartId;
    application.order_id = orderId;
    application.discount_amount = discountAmount;
    application.discount_type = promoCode.discount_type;
    application.created_at = new Date();

    // Increment promo code usage
    await this.promoRepo.incrementUsage(promoCode.id, storeId);

    return this.discountRepo.save(application);
  }

  async getAppliedDiscounts(
    storeId: string,
    cartId?: string,
    orderId?: string
  ): Promise<DiscountApplicationEntity[]> {
    if (cartId) {
      return this.discountRepo.findByCart(cartId, storeId);
    } else if (orderId) {
      return this.discountRepo.findByOrder(orderId, storeId);
    }
    return [];
  }

  async getTotalDiscount(storeId: string, cartId?: string, orderId?: string): Promise<number> {
    const applications = await this.getAppliedDiscounts(storeId, cartId, orderId);
    return applications.reduce((sum, app) => sum + app.discount_amount, 0);
  }

  async moveDiscountsToOrder(cartId: string, orderId: string, storeId: string): Promise<void> {
    return this.discountRepo.moveCartDiscountsToOrder(cartId, orderId, storeId);
  }

  async getPromoAnalytics(storeId: string): Promise<{
    totalDiscountsGiven: number;
    mostUsedPromo?: string;
    totalActivePromos: number;
  }> {
    const total = await this.discountRepo.getTotalDiscounts(storeId);
    const active = await this.promoRepo.findActive(storeId);

    return {
      totalDiscountsGiven: total,
      totalActivePromos: active.length,
    };
  }
}
