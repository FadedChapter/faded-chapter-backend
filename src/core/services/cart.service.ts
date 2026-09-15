/**
 * Cart & Checkout Services
 * Shopping cart management and checkout workflow
 *
 * Phase 6: Cart & Checkout Domain
 */

import { CartEntity } from '../entities/cart.entity';
import { CartLineEntity } from '../entities/cart-line.entity';
import { CartRepository, CartLineRepository } from '../repositories/cart.repositories';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';
import { OrderService } from './order.service';
import {
  AddToCartDto,
  UpdateCartLineDto,
  ApplyCouponDto,
  RemoveCouponDto,
  CheckoutDto,
  CartTotalsDto,
} from '../dtos/cart.dto';

/**
 * Cart Service
 */
export class CartService {
  constructor(
    private cartRepo: CartRepository,
    private lineRepo: CartLineRepository,
    private orderService: OrderService
  ) {}

  async getOrCreateCart(customerId: string, storeId: string): Promise<CartEntity> {
    return this.cartRepo.getOrCreateCart(customerId, storeId);
  }

  async getCart(storeId: string, customerId: string): Promise<CartEntity> {
    const cart = await this.cartRepo.findByCustomer(customerId, storeId);
    if (!cart) {
      throw new Error('Cart not found');
    }
    return cart;
  }

  async addToCart(customerId: string, storeId: string, dto: AddToCartDto): Promise<CartEntity> {
    const cart = await this.cartRepo.getOrCreateCart(customerId, storeId);

    // Check if variant already in cart
    let line = await this.lineRepo.findByVariant(
      dto.product_variant_id,
      cart.id,
      storeId
    );

    if (line) {
      // Update quantity
      line.quantity += dto.quantity;
      line.line_total = line.quantity * line.unit_price;
      line.updated_at = new Date();
      await this.lineRepo.save(line);
    } else {
      // Add new line
      line = new CartLineEntity();
      line.id = crypto.randomUUID();
      line.cart_id = cart.id;
      line.store_id = storeId;
      line.product_variant_id = dto.product_variant_id;
      line.product_id = dto.product_id;
      line.quantity = dto.quantity;
      line.unit_price = dto.unit_price;
      line.line_total = dto.quantity * dto.unit_price;
      line.sku = dto.sku;
      line.product_name = dto.product_name;
      line.variant_name = dto.variant_name;
      line.metadata = dto.metadata || {};
      line.created_at = new Date();
      line.updated_at = new Date();

      await this.lineRepo.save(line);
    }

    // Recalculate totals
    await this.recalculateTotals(cart.id, storeId);

    return this.getCart(storeId, customerId);
  }

  async updateLine(
    customerId: string,
    storeId: string,
    lineId: string,
    dto: UpdateCartLineDto
  ): Promise<CartEntity> {
    const cart = await this.getCart(storeId, customerId);
    await this.lineRepo.updateQuantity(lineId, cart.id, storeId, dto.quantity);
    await this.recalculateTotals(cart.id, storeId);
    return this.getCart(storeId, customerId);
  }

  async removeLineItem(
    customerId: string,
    storeId: string,
    lineId: string
  ): Promise<CartEntity> {
    const cart = await this.getCart(storeId, customerId);
    await this.lineRepo.removeLine(lineId, storeId);
    await this.recalculateTotals(cart.id, storeId);
    return this.getCart(storeId, customerId);
  }

  async applyCoupon(
    customerId: string,
    storeId: string,
    dto: ApplyCouponDto
  ): Promise<CartEntity> {
    const cart = await this.getCart(storeId, customerId);
    const updated = await this.cartRepo.addCoupon(cart.id, storeId, dto.coupon_code);
    await this.recalculateTotals(cart.id, storeId);
    return updated;
  }

  async removeCoupon(
    customerId: string,
    storeId: string,
    dto: RemoveCouponDto
  ): Promise<CartEntity> {
    const cart = await this.getCart(storeId, customerId);
    const updated = await this.cartRepo.removeCoupon(cart.id, storeId, dto.coupon_code);
    await this.recalculateTotals(cart.id, storeId);
    return updated;
  }

  async clearCart(customerId: string, storeId: string): Promise<CartEntity> {
    const cart = await this.getCart(storeId, customerId);
    await this.cartRepo.clearCart(cart.id, storeId);
    return this.getCart(storeId, customerId);
  }

  async recalculateTotals(cartId: string, storeId: string): Promise<CartEntity> {
    const subtotal = await this.lineRepo.calculateCartSubtotal(cartId, storeId);

    // TODO: Implement tax and shipping calculation based on store settings
    const taxEstimate = subtotal * 0.08; // 8% tax placeholder
    const shippingEstimate = 10; // Flat rate placeholder
    const discountAmount = 0; // TODO: Calculate from coupons

    return this.cartRepo.updateTotals(cartId, storeId, {
      subtotal,
      tax: taxEstimate,
      shipping: shippingEstimate,
      discount: discountAmount,
    });
  }

  async getAbandonedCarts(storeId: string, daysSince: number = 1): Promise<CartEntity[]> {
    return this.cartRepo.getAbandonedCarts(storeId, daysSince);
  }

  async markAbandonedEmailSent(storeId: string, cartId: string): Promise<CartEntity> {
    return this.cartRepo.markAbandonedEmailSent(cartId, storeId);
  }

  async convertToOrder(
    customerId: string,
    storeId: string,
    checkoutData: CheckoutDto
  ): Promise<{ cartId: string; orderId: string }> {
    const cart = await this.getCart(storeId, customerId);

    if (!cart.lines || cart.lines.length === 0) {
      throw new Error('Cannot checkout with empty cart');
    }

    // Create order from cart
    const lines = cart.lines.map((line) => ({
      product_variant_id: line.product_variant_id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
      sku: line.sku,
      product_name: line.product_name,
      variant_name: line.variant_name,
    }));

    const order = await this.orderService.createOrder(storeId, {
      customer_id: customerId,
      lines,
      subtotal: cart.subtotal,
      tax_amount: cart.tax_estimate,
      shipping_amount: cart.shipping_estimate,
      discount_amount: cart.discount_amount,
      shipping_address: checkoutData.shipping_address,
      billing_address: checkoutData.billing_address,
      payment_method: checkoutData.payment_method,
      notes: checkoutData.notes,
      metadata: checkoutData.metadata,
    });

    // Mark cart as converted
    await this.cartRepo.markConverted(cart.id, storeId);

    return {
      cartId: cart.id,
      orderId: order.id,
    };
  }
}

/**
 * Cart Line Service
 */
export class CartLineService {
  constructor(private lineRepo: CartLineRepository) {}

  async getLines(cartId: string, storeId: string): Promise<CartLineEntity[]> {
    return this.lineRepo.findByCartId(cartId, storeId);
  }

  async getItemCount(cartId: string, storeId: string): Promise<number> {
    return this.lineRepo.countItems(cartId, storeId);
  }

  async calculateSubtotal(cartId: string, storeId: string): Promise<number> {
    return this.lineRepo.calculateCartSubtotal(cartId, storeId);
  }
}
