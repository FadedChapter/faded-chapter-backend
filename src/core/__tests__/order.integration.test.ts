/**
 * Order Management Integration Tests
 * Testing order creation, fulfillment, payment, and cancellation
 *
 * Phase 5: Order Management Domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrderEntity } from '../entities/order.entity';
import { OrderLineEntity } from '../entities/order-line.entity';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';
import { OrderService, OrderLineService } from '../services/order.service';

describe('Order Management Integration Tests', () => {
  let orderRepo: OrderRepository;
  let lineRepo: OrderLineRepository;
  let orderService: OrderService;
  let lineService: OrderLineService;

  const storeId = '550e8400-e29b-41d4-a716-446655440001';
  const customerId = '550e8400-e29b-41d4-a716-446655440100';

  beforeEach(() => {
    orderRepo = new OrderRepository();
    lineRepo = new OrderLineRepository();
    orderService = new OrderService(orderRepo, lineRepo);
    lineService = new OrderLineService(lineRepo);
  });

  describe('Order Creation', () => {
    it('should create an order with lines', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [
          {
            product_variant_id: '550e8400-e29b-41d4-a716-446655440200',
            product_id: '550e8400-e29b-41d4-a716-446655440201',
            quantity: 2,
            unit_price: 29.99,
            sku: 'SHIRT-001',
            product_name: 'Blue Shirt',
            variant_name: 'Blue Shirt - Large',
          },
        ],
        subtotal: 59.98,
        tax_amount: 5.0,
        shipping_amount: 10.0,
        shipping_address: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
        },
      });

      expect(order).toBeDefined();
      expect(order.order_number).toMatch(/^ORD-/);
      expect(order.status).toBe('pending');
      expect(order.payment_status).toBe('unpaid');
      expect(order.total).toBe(74.98); // subtotal + tax + shipping
    });

    it('should generate sequential order numbers', async () => {
      const order1 = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const order2 = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      expect(order1.order_number).not.toBe(order2.order_number);

      // Parse numbers to verify sequence
      const num1 = parseInt(order1.order_number.match(/\d+/)![0]);
      const num2 = parseInt(order2.order_number.match(/\d+/)![0]);
      expect(num2).toBeGreaterThan(num1);
    });
  });

  describe('Order Retrieval', () => {
    it('should retrieve order with lines', async () => {
      const created = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [
          {
            product_variant_id: '550e8400-e29b-41d4-a716-446655440202',
            product_id: '550e8400-e29b-41d4-a716-446655440203',
            quantity: 1,
            unit_price: 49.99,
            sku: 'PANTS-001',
            product_name: 'Blue Pants',
          },
        ],
        subtotal: 49.99,
        shipping_address: { street: '123 Main St' },
      });

      const retrieved = await orderService.getOrder(storeId, created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.lines).toBeDefined();
      expect(retrieved.lines.length).toBe(1);
    });

    it('should retrieve order by order number', async () => {
      const created = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const retrieved = await orderService.getOrderByNumber(storeId, created.order_number);

      expect(retrieved).toBeDefined();
      expect(retrieved?.order_number).toBe(created.order_number);
    });

    it('should list orders by customer', async () => {
      await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const orders = await orderService.listOrdersByCustomer(customerId, storeId);

      expect(orders.length).toBeGreaterThan(0);
      expect(orders[0].customer_id).toBe(customerId);
    });

    it('should list orders by status', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const pendingOrders = await orderService.listOrdersByStatus('pending', storeId);

      expect(pendingOrders.length).toBeGreaterThan(0);
      expect(pendingOrders[0].status).toBe('pending');
    });
  });

  describe('Order Status Management', () => {
    it('should mark order as paid', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const paid = await orderService.markAsPaid(storeId, order.id, {
        payment_method: 'credit_card',
      });

      expect(paid.payment_status).toBe('paid');
      expect(paid.payment_method).toBe('credit_card');
    });

    it('should mark order as shipped', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const shipped = await orderService.markAsShipped(storeId, order.id, {
        tracking_number: 'TRACK123',
        carrier: 'FedEx',
      });

      expect(shipped.status).toBe('shipped');
      expect(shipped.metadata?.tracking_number).toBe('TRACK123');
    });

    it('should cancel order', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const cancelled = await orderService.cancelOrder(storeId, order.id, 'Customer requested');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelled_at).toBeDefined();
    });
  });

  describe('Order Line Management', () => {
    it('should update order line quantity', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [
          {
            product_variant_id: '550e8400-e29b-41d4-a716-446655440204',
            product_id: '550e8400-e29b-41d4-a716-446655440205',
            quantity: 1,
            unit_price: 50.0,
            sku: 'ITEM-001',
            product_name: 'Test Item',
          },
        ],
        subtotal: 50.0,
        shipping_address: { street: '123 Main St' },
      });

      const line = order.lines[0];
      const updated = await lineService.updateLine(storeId, line.id, { quantity: 3 });

      expect(updated.quantity).toBe(3);
      expect(updated.line_total).toBe(150.0); // 3 * 50
    });

    it('should fulfill order line', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [
          {
            product_variant_id: '550e8400-e29b-41d4-a716-446655440206',
            product_id: '550e8400-e29b-41d4-a716-446655440207',
            quantity: 2,
            unit_price: 50.0,
            sku: 'ITEM-002',
            product_name: 'Test Item 2',
          },
        ],
        subtotal: 100.0,
        shipping_address: { street: '123 Main St' },
      });

      const line = order.lines[0];
      const fulfilled = await lineService.fulfillLine(storeId, line.id, {});

      expect(fulfilled.fulfillment_status).toBe('fulfilled');
    });

    it('should get unfulfilled lines', async () => {
      const order = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [
          {
            product_variant_id: '550e8400-e29b-41d4-a716-446655440208',
            product_id: '550e8400-e29b-41d4-a716-446655440209',
            quantity: 1,
            unit_price: 50.0,
            sku: 'ITEM-003',
            product_name: 'Test Item 3',
          },
        ],
        subtotal: 50.0,
        shipping_address: { street: '123 Main St' },
      });

      const unfulfilled = await lineService.getUnfulfilledLines(storeId);

      expect(unfulfilled.length).toBeGreaterThan(0);
      expect(unfulfilled[0].fulfillment_status).toBe('unfulfilled');
    });
  });

  describe('Order Store Isolation', () => {
    it('should isolate orders by store', async () => {
      const storeId2 = '550e8400-e29b-41d4-a716-446655440002';

      const order1 = await orderService.createOrder(storeId, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '123 Main St' },
      });

      const order2 = await orderService.createOrder(storeId2, {
        customer_id: customerId,
        lines: [],
        subtotal: 100,
        shipping_address: { street: '456 Oak Ave' },
      });

      const retrieved1 = await orderService.getOrder(storeId, order1.id);
      expect(retrieved1.store_id).toBe(storeId);

      expect(orderService.getOrder(storeId2, order1.id)).rejects.toThrow();
    });
  });
});
