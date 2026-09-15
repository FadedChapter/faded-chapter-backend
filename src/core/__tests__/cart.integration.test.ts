/**
 * Cart & Checkout Integration Tests
 * Testing cart operations, checkout flow, and cart management
 *
 * Phase 6: Cart & Checkout Domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CartEntity } from '../entities/cart.entity';
import { CartLineEntity } from '../entities/cart-line.entity';
import { CartRepository, CartLineRepository } from '../repositories/cart.repositories';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';
import { CartService, CartLineService } from '../services/cart.service';
import { OrderService } from '../services/order.service';

describe('Cart & Checkout Integration Tests', () => {
  let cartRepo: CartRepository;
  let lineRepo: CartLineRepository;
  let orderRepo: OrderRepository;
  let orderLineRepo: OrderLineRepository;
  let cartService: CartService;
  let lineService: CartLineService;
  let orderService: OrderService;

  const storeId = '550e8400-e29b-41d4-a716-446655440001';
  const customerId = '550e8400-e29b-41d4-a716-446655440100';

  beforeEach(() => {
    cartRepo = new CartRepository();
    lineRepo = new CartLineRepository();
    orderRepo = new OrderRepository();
    orderLineRepo = new OrderLineRepository();
    orderService = new OrderService(orderRepo, orderLineRepo);
    cartService = new CartService(cartRepo, lineRepo, orderService);
    lineService = new CartLineService(lineRepo);
  });

  describe('Cart Creation & Retrieval', () => {
    it('should create or get existing cart', async () => {
      const cart = await cartService.getOrCreateCart(customerId, storeId);

      expect(cart).toBeDefined();
      expect(cart.customer_id).toBe(customerId);
      expect(cart.store_id).toBe(storeId);
      expect(cart.status).toBe('active');
    });

    it('should return same cart on second call', async () => {
      const cart1 = await cartService.getOrCreateCart(customerId, storeId);
      const cart2 = await cartService.getOrCreateCart(customerId, storeId);

      expect(cart1.id).toBe(cart2.id);
    });

    it('should retrieve cart with items', async () => {
      const cart = await cartService.getOrCreateCart(customerId, storeId);

      await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440200',
        product_id: '550e8400-e29b-41d4-a716-446655440201',
        quantity: 1,
        unit_price: 29.99,
        sku: 'SHIRT-001',
        product_name: 'Blue Shirt',
      });

      const retrieved = await cartService.getCart(storeId, customerId);

      expect(retrieved.lines).toBeDefined();
      expect(retrieved.lines.length).toBeGreaterThan(0);
    });
  });

  describe('Add to Cart', () => {
    it('should add item to cart', async () => {
      const result = await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440202',
        product_id: '550e8400-e29b-41d4-a716-446655440203',
        quantity: 2,
        unit_price: 49.99,
        sku: 'PANTS-001',
        product_name: 'Blue Pants',
      });

      expect(result.lines).toBeDefined();
      expect(result.lines.length).toBe(1);
      expect(result.lines[0].quantity).toBe(2);
      expect(result.lines[0].line_total).toBe(99.98); // 2 * 49.99
    });

    it('should update quantity if variant already in cart', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440204';

      // Add first time
      await cartService.addToCart(customerId, storeId, {
        product_variant_id: variantId,
        product_id: '550e8400-e29b-41d4-a716-446655440205',
        quantity: 1,
        unit_price: 30.0,
        sku: 'ITEM-001',
        product_name: 'Item 1',
      });

      // Add same variant again
      const result = await cartService.addToCart(customerId, storeId, {
        product_variant_id: variantId,
        product_id: '550e8400-e29b-41d4-a716-446655440205',
        quantity: 2,
        unit_price: 30.0,
        sku: 'ITEM-001',
        product_name: 'Item 1',
      });

      expect(result.lines.length).toBe(1);
      expect(result.lines[0].quantity).toBe(3); // 1 + 2
    });

    it('should calculate subtotal after adding items', async () => {
      await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440206',
        product_id: '550e8400-e29b-41d4-a716-446655440207',
        quantity: 2,
        unit_price: 25.0,
        sku: 'ITEM-002',
        product_name: 'Item 2',
      });

      const cart = await cartService.getCart(storeId, customerId);

      expect(cart.subtotal).toBe(50.0); // 2 * 25
    });
  });

  describe('Update Cart Items', () => {
    it('should update item quantity', async () => {
      const cart = await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440208',
        product_id: '550e8400-e29b-41d4-a716-446655440209',
        quantity: 1,
        unit_price: 50.0,
        sku: 'ITEM-003',
        product_name: 'Item 3',
      });

      const lineId = cart.lines[0].id;
      const updated = await cartService.updateLine(customerId, storeId, lineId, {
        quantity: 3,
      });

      expect(updated.lines[0].quantity).toBe(3);
      expect(updated.lines[0].line_total).toBe(150.0);
    });

    it('should remove item from cart', async () => {
      const cart = await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440210',
        product_id: '550e8400-e29b-41d4-a716-446655440211',
        quantity: 1,
        unit_price: 50.0,
        sku: 'ITEM-004',
        product_name: 'Item 4',
      });

      const lineId = cart.lines[0].id;
      const result = await cartService.removeLineItem(customerId, storeId, lineId);

      expect(result.lines.length).toBe(0);
      expect(result.subtotal).toBe(0);
    });
  });

  describe('Coupon Management', () => {
    it('should apply coupon code to cart', async () => {
      const cart = await cartService.getOrCreateCart(customerId, storeId);

      const updated = await cartService.applyCoupon(customerId, storeId, {
        coupon_code: 'SAVE20',
      });

      expect(updated.coupon_codes).toContain('SAVE20');
    });

    it('should remove coupon code', async () => {
      const cart = await cartService.getOrCreateCart(customerId, storeId);

      await cartService.applyCoupon(customerId, storeId, { coupon_code: 'SAVE20' });
      const removed = await cartService.removeCoupon(customerId, storeId, {
        coupon_code: 'SAVE20',
      });

      expect(removed.coupon_codes).not.toContain('SAVE20');
    });

    it('should not duplicate coupon codes', async () => {
      const cart = await cartService.getOrCreateCart(customerId, storeId);

      await cartService.applyCoupon(customerId, storeId, { coupon_code: 'SAVE20' });
      const again = await cartService.applyCoupon(customerId, storeId, {
        coupon_code: 'SAVE20',
      });

      const count = again.coupon_codes.filter((c) => c === 'SAVE20').length;
      expect(count).toBe(1);
    });
  });

  describe('Cart Totals', () => {
    it('should calculate cart totals', async () => {
      const cart = await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440212',
        product_id: '550e8400-e29b-41d4-a716-446655440213',
        quantity: 1,
        unit_price: 100.0,
        sku: 'ITEM-005',
        product_name: 'Item 5',
      });

      // Cart should have subtotal, tax estimate, and shipping estimate
      expect(cart.subtotal).toBe(100.0);
      expect(cart.tax_estimate).toBeGreaterThan(0);
      expect(cart.shipping_estimate).toBeGreaterThan(0);
      expect(cart.total_estimate).toBe(
        cart.subtotal + cart.tax_estimate + cart.shipping_estimate - cart.discount_amount
      );
    });

    it('should clear cart', async () => {
      await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440214',
        product_id: '550e8400-e29b-41d4-a716-446655440215',
        quantity: 2,
        unit_price: 50.0,
        sku: 'ITEM-006',
        product_name: 'Item 6',
      });

      const cleared = await cartService.clearCart(customerId, storeId);

      expect(cleared.lines.length).toBe(0);
      expect(cleared.subtotal).toBe(0);
      expect(cleared.coupon_codes.length).toBe(0);
    });
  });

  describe('Checkout Workflow', () => {
    it('should convert cart to order', async () => {
      const cart = await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440216',
        product_id: '550e8400-e29b-41d4-a716-446655440217',
        quantity: 1,
        unit_price: 99.99,
        sku: 'FINAL-001',
        product_name: 'Final Item',
      });

      const result = await cartService.convertToOrder(customerId, storeId, {
        shipping_address: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
        },
      });

      expect(result.orderId).toBeDefined();
      expect(result.cartId).toBe(cart.id);
    });

    it('should not checkout empty cart', async () => {
      const cart = await cartService.getOrCreateCart(customerId, storeId);

      expect(
        cartService.convertToOrder(customerId, storeId, {
          shipping_address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
        })
      ).rejects.toThrow('empty cart');
    });
  });

  describe('Cart Store Isolation', () => {
    it('should isolate carts by store', async () => {
      const storeId2 = '550e8400-e29b-41d4-a716-446655440002';

      const cart1 = await cartService.getOrCreateCart(customerId, storeId);
      const cart2 = await cartService.getOrCreateCart(customerId, storeId2);

      expect(cart1.store_id).toBe(storeId);
      expect(cart2.store_id).toBe(storeId2);
      expect(cart1.id).not.toBe(cart2.id);
    });
  });

  describe('Cart Analytics', () => {
    it('should get item count', async () => {
      const cart = await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440218',
        product_id: '550e8400-e29b-41d4-a716-446655440219',
        quantity: 3,
        unit_price: 20.0,
        sku: 'BULK-001',
        product_name: 'Bulk Item',
      });

      const count = await lineService.getItemCount(cart.id, storeId);

      expect(count).toBe(3);
    });

    it('should calculate subtotal', async () => {
      const cart = await cartService.addToCart(customerId, storeId, {
        product_variant_id: '550e8400-e29b-41d4-a716-446655440220',
        product_id: '550e8400-e29b-41d4-a716-446655440221',
        quantity: 2,
        unit_price: 75.0,
        sku: 'CALC-001',
        product_name: 'Calc Item',
      });

      const subtotal = await lineService.calculateSubtotal(cart.id, storeId);

      expect(subtotal).toBe(150.0); // 2 * 75
    });
  });
});
