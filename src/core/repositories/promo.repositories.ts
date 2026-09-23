/**
 * Promotions & Discounts Repositories
 * Promo code and discount application repositories with validation
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { BaseRepository } from '../repository/base-repository';
import { PromoCodeEntity } from '../entities/promo-code.entity';
import { DiscountApplicationEntity } from '../entities/discount-application.entity';

/**
 * Promo Code Repository
 */
export class PromoCodeRepository extends BaseRepository<PromoCodeEntity> {
  constructor() {
    super(PromoCodeEntity);
  }

  async findByCode(code: string, storeId: string): Promise<PromoCodeEntity | null> {
    return this.repository.findOne({
      where: { code: code.toUpperCase(), store_id: storeId } as any,
    });
  }

  async findActive(storeId: string): Promise<PromoCodeEntity[]> {
    const now = new Date();

    return this.repository
      .createQueryBuilder('pc')
      .where('pc.store_id = :storeId', { storeId })
      .andWhere('pc.status = :status', { status: 'active' })
      .andWhere('pc.start_date <= :now', { now })
      .andWhere('(pc.end_date IS NULL OR pc.end_date > :now)', { now })
      .getMany();
  }

  async validateCode(code: string, storeId: string, cartSubtotal: number): Promise<{
    valid: boolean;
    error?: string;
    promoCode?: PromoCodeEntity;
  }> {
    const promo = await this.findByCode(code, storeId);

    if (!promo) {
      return { valid: false, error: 'Promo code not found' };
    }

    if (promo.status === 'inactive') {
      return { valid: false, error: 'Promo code is inactive' };
    }

    if (promo.status === 'expired') {
      return { valid: false, error: 'Promo code has expired' };
    }

    const now = new Date();
    if (promo.start_date > now) {
      return { valid: false, error: 'Promo code is not yet active' };
    }

    if (promo.end_date && promo.end_date < now) {
      return { valid: false, error: 'Promo code has expired' };
    }

    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return { valid: false, error: 'Promo code usage limit reached' };
    }

    if (cartSubtotal < promo.min_purchase) {
      return {
        valid: false,
        error: `Minimum purchase of $${promo.min_purchase} required`,
      };
    }

    return { valid: true, promoCode: promo };
  }

  async incrementUsage(codeId: string, storeId: string): Promise<PromoCodeEntity> {
    const code = await this.findByIdOrFail(codeId, storeId);
    code.usage_count += 1;
    code.updated_at = new Date();

    // Auto-expire if limit reached
    if (code.usage_limit && code.usage_count >= code.usage_limit) {
      code.status = 'expired';
    }

    return this.save(code);
  }

  async getByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<PromoCodeEntity[]> {
    return this.repository
      .createQueryBuilder('pc')
      .where('pc.store_id = :storeId', { storeId })
      .andWhere('pc.start_date >= :startDate', { startDate })
      .andWhere('(pc.end_date IS NULL OR pc.end_date <= :endDate)', { endDate })
      .orderBy('pc.start_date', 'ASC')
      .getMany();
  }

  async getExpiring(storeId: string, daysUntilExpiry: number = 7): Promise<PromoCodeEntity[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysUntilExpiry);

    return this.repository
      .createQueryBuilder('pc')
      .where('pc.store_id = :storeId', { storeId })
      .andWhere('pc.end_date IS NOT NULL')
      .andWhere('pc.end_date >= :startDate', { startDate })
      .andWhere('pc.end_date <= :endDate', { endDate })
      .andWhere('pc.status = :status', { status: 'active' })
      .orderBy('pc.end_date', 'ASC')
      .getMany();
  }

  async updateStatus(codeId: string, storeId: string, status: string): Promise<PromoCodeEntity> {
    const code = await this.findByIdOrFail(codeId, storeId);
    code.status = status as any;
    code.updated_at = new Date();
    return this.save(code);
  }
}

/**
 * Discount Application Repository
 */
export class DiscountApplicationRepository extends BaseRepository<DiscountApplicationEntity> {
  constructor() {
    super(DiscountApplicationEntity);
  }

  async findByCart(cartId: string, storeId: string): Promise<DiscountApplicationEntity[]> {
    return this.repository.find({
      where: { cart_id: cartId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
    });
  }

  async findByOrder(orderId: string, storeId: string): Promise<DiscountApplicationEntity[]> {
    return this.repository.find({
      where: { order_id: orderId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
    });
  }

  async findByPromoCode(
    promoCodeId: string,
    storeId: string,
    limit: number = 100
  ): Promise<DiscountApplicationEntity[]> {
    return this.repository.find({
      where: { promo_code_id: promoCodeId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
      take: limit,
    });
  }

  async getTotalDiscounts(storeId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('da')
      .where('da.store_id = :storeId', { storeId })
      .select('COALESCE(SUM(da.discount_amount), 0)', 'total')
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  async getDiscountByPromo(promoCodeId: string, storeId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('da')
      .where('da.promo_code_id = :promoCodeId', { promoCodeId })
      .andWhere('da.store_id = :storeId', { storeId })
      .select('COALESCE(SUM(da.discount_amount), 0)', 'total')
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  async moveCartDiscountsToOrder(cartId: string, orderId: string, storeId: string): Promise<void> {
    await this.repository.update(
      { cart_id: cartId, store_id: storeId } as any,
      { order_id: orderId, cart_id: null as any, created_at: new Date() }
    );
  }
}
