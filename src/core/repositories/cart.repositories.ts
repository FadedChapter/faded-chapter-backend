/**
 * Cart Management Repositories
 * Cart and CartLine repositories with store isolation
 *
 * Phase 6: Cart & Checkout Domain
 */

import { BaseRepository } from '../repository/base-repository';
import { CartEntity } from '../entities/cart.entity';
import { CartLineEntity } from '../entities/cart-line.entity';

/**
 * Cart Repository
 */
export class CartRepository extends BaseRepository<CartEntity> {
  constructor() {
    super(CartEntity);
  }

  async findByCustomer(customerId: string, storeId: string): Promise<CartEntity | null> {
    return this.repository.findOne({
      where: { customer_id: customerId, store_id: storeId } as any,
      relations: ['lines'] as any,
    });
  }

  async getOrCreateCart(customerId: string, storeId: string): Promise<CartEntity> {
    let cart = await this.findByCustomer(customerId, storeId);

    if (!cart) {
      cart = new CartEntity();
      cart.id = crypto.randomUUID();
      cart.store_id = storeId;
      cart.customer_id = customerId;
      cart.status = 'active';
      cart.subtotal = 0;
      cart.tax_estimate = 0;
      cart.shipping_estimate = 0;
      cart.discount_amount = 0;
      cart.total_estimate = 0;
      cart.coupon_codes = [];
      cart.metadata = {};
      cart.created_at = new Date();
      cart.updated_at = new Date();

      await this.save(cart);
    }

    return cart;
  }

  async clearCart(cartId: string, storeId: string): Promise<void> {
    const cart = await this.findByIdOrFail(cartId, storeId);
    cart.lines = [];
    cart.subtotal = 0;
    cart.tax_estimate = 0;
    cart.shipping_estimate = 0;
    cart.discount_amount = 0;
    cart.total_estimate = 0;
    cart.coupon_codes = [];
    cart.updated_at = new Date();
    await this.save(cart);
  }

  async updateTotals(cartId: string, storeId: string, totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
  }): Promise<CartEntity> {
    const cart = await this.findByIdOrFail(cartId, storeId);
    cart.subtotal = totals.subtotal;
    cart.tax_estimate = totals.tax;
    cart.shipping_estimate = totals.shipping;
    cart.discount_amount = totals.discount;
    cart.total_estimate = totals.subtotal + totals.tax + totals.shipping - totals.discount;
    cart.updated_at = new Date();
    return this.save(cart);
  }

  async addCoupon(cartId: string, storeId: string, couponCode: string): Promise<CartEntity> {
    const cart = await this.findByIdOrFail(cartId, storeId);
    if (!cart.coupon_codes.includes(couponCode)) {
      cart.coupon_codes.push(couponCode);
      cart.updated_at = new Date();
      await this.save(cart);
    }
    return cart;
  }

  async removeCoupon(cartId: string, storeId: string, couponCode: string): Promise<CartEntity> {
    const cart = await this.findByIdOrFail(cartId, storeId);
    cart.coupon_codes = cart.coupon_codes.filter((code) => code !== couponCode);
    cart.updated_at = new Date();
    return this.save(cart);
  }

  async markConverted(cartId: string, storeId: string): Promise<CartEntity> {
    const cart = await this.findByIdOrFail(cartId, storeId);
    cart.status = 'converted';
    cart.converted_at = new Date();
    cart.updated_at = new Date();
    return this.save(cart);
  }

  async markAbandoned(cartId: string, storeId: string): Promise<CartEntity> {
    const cart = await this.findByIdOrFail(cartId, storeId);
    cart.status = 'abandoned';
    cart.updated_at = new Date();
    return this.save(cart);
  }

  async getAbandonedCarts(storeId: string, daysSince: number = 1): Promise<CartEntity[]> {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - daysSince);

    return this.repository
      .createQueryBuilder('c')
      .where('c.store_id = :storeId', { storeId })
      .andWhere('c.status = :status', { status: 'active' })
      .andWhere('c.abandoned_email_sent = :sent', { sent: false })
      .andWhere('c.updated_at < :date', { date: daysAgo })
      .getMany();
  }

  async markAbandonedEmailSent(cartId: string, storeId: string): Promise<CartEntity> {
    const cart = await this.findByIdOrFail(cartId, storeId);
    cart.abandoned_email_sent = true;
    cart.updated_at = new Date();
    return this.save(cart);
  }

  async countActiveCarts(storeId: string): Promise<number> {
    return this.repository.count({
      where: { status: 'active', store_id: storeId } as any,
    });
  }

  async getTotalCartValue(storeId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('c')
      .where('c.store_id = :storeId', { storeId })
      .andWhere('c.status = :status', { status: 'active' })
      .select('COALESCE(SUM(c.total_estimate), 0)', 'total')
      .getRawOne();

    return parseFloat(result?.total || 0);
  }
}

/**
 * Cart Line Repository
 */
export class CartLineRepository extends BaseRepository<CartLineEntity> {
  constructor() {
    super(CartLineEntity);
  }

  async findByCartId(cartId: string, storeId: string): Promise<CartLineEntity[]> {
    return this.repository.find({
      where: { cart_id: cartId, store_id: storeId } as any,
      order: { created_at: 'ASC' } as any,
    });
  }

  async findByVariant(
    variantId: string,
    cartId: string,
    storeId: string
  ): Promise<CartLineEntity | null> {
    return this.repository.findOne({
      where: { product_variant_id: variantId, cart_id: cartId, store_id: storeId } as any,
    });
  }

  async updateQuantity(
    lineId: string,
    cartId: string,
    storeId: string,
    quantity: number
  ): Promise<CartLineEntity> {
    const line = await this.findByIdOrFail(lineId, storeId);

    if (quantity <= 0) {
      // Remove line if quantity is 0 or less
      await this.repository.delete({ id: lineId, store_id: storeId } as any);
      throw new Error('Line removed - quantity must be positive');
    }

    line.quantity = quantity;
    line.line_total = quantity * line.unit_price;
    line.updated_at = new Date();

    return this.save(line);
  }

  async removeLine(lineId: string, storeId: string): Promise<void> {
    await this.repository.delete({ id: lineId, store_id: storeId } as any);
  }

  async countItems(cartId: string, storeId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('cl')
      .where('cl.cart_id = :cartId', { cartId })
      .andWhere('cl.store_id = :storeId', { storeId })
      .select('COALESCE(SUM(cl.quantity), 0)', 'total')
      .getRawOne();

    return parseInt(result?.total || 0);
  }

  async calculateCartSubtotal(cartId: string, storeId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('cl')
      .where('cl.cart_id = :cartId', { cartId })
      .andWhere('cl.store_id = :storeId', { storeId })
      .select('COALESCE(SUM(cl.line_total), 0)', 'subtotal')
      .getRawOne();

    return parseFloat(result?.subtotal || 0);
  }

  async deleteByCart(cartId: string, storeId: string): Promise<void> {
    await this.repository.delete({ cart_id: cartId, store_id: storeId } as any);
  }
}
