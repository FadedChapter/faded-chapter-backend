/**
 * Order Management Services
 * Business logic for order processing, fulfillment, and payments
 *
 * Phase 5: Order Management Domain
 */

import { OrderEntity } from '../entities/order.entity';
import { OrderLineEntity } from '../entities/order-line.entity';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateOrderLineDto,
  UpdateOrderLineDto,
  MarkAsPaidDto,
  MarkAsShippedDto,
  FulfillLineDto,
} from '../dtos/order.dto';

/**
 * Order Service
 */
export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private lineRepo: OrderLineRepository
  ) {}

  async createOrder(storeId: string, dto: CreateOrderDto): Promise<OrderEntity> {
    // Get next order number
    const orderNumber = await this.orderRepo.getNextOrderNumber(storeId);

    // Calculate totals
    const lines = dto.lines || [];
    const subtotal = lines.reduce((sum, line) => sum + (line.unit_price * line.quantity), 0);

    const order = new OrderEntity();
    order.id = crypto.randomUUID();
    order.store_id = storeId;
    order.customer_id = dto.customer_id;
    order.order_number = orderNumber;
    order.status = 'pending';
    order.payment_status = 'unpaid';
    order.fulfillment_status = 'unfulfilled';
    order.subtotal = dto.subtotal || subtotal;
    order.tax_amount = dto.tax_amount || 0;
    order.shipping_amount = dto.shipping_amount || 0;
    order.discount_amount = dto.discount_amount || 0;
    order.total = order.subtotal + order.tax_amount + order.shipping_amount - order.discount_amount;
    order.notes = dto.notes;
    order.customer_notes = dto.customer_notes;
    order.payment_method = dto.payment_method;
    order.shipping_address = dto.shipping_address;
    order.billing_address = dto.billing_address || dto.shipping_address;
    order.metadata = dto.metadata || {};
    order.created_at = new Date();
    order.updated_at = new Date();

    // Save order first
    const savedOrder = await this.orderRepo.save(order);

    // Create order lines
    if (lines && lines.length > 0) {
      const orderLines = lines.map((line) => {
        const orderLine = new OrderLineEntity();
        orderLine.id = crypto.randomUUID();
        orderLine.order_id = savedOrder.id;
        orderLine.store_id = storeId;
        orderLine.product_variant_id = line.product_variant_id;
        orderLine.product_id = line.product_id;
        orderLine.quantity = line.quantity;
        orderLine.unit_price = line.unit_price;
        orderLine.line_total = line.unit_price * line.quantity;
        orderLine.sku = line.sku;
        orderLine.product_name = line.product_name;
        orderLine.variant_name = line.variant_name;
        orderLine.fulfillment_status = 'unfulfilled';
        orderLine.metadata = line.metadata || {};
        orderLine.created_at = new Date();
        orderLine.updated_at = new Date();
        return orderLine;
      });

      await Promise.all(orderLines.map((line) => this.lineRepo.save(line)));
      savedOrder.lines = orderLines;
    }

    return savedOrder;
  }

  async getOrder(storeId: string, orderId: string): Promise<OrderEntity> {
    const order = await this.orderRepo.findByIdOrFail(orderId, storeId);
    const lines = await this.lineRepo.findByOrderId(orderId, storeId);
    order.lines = lines;
    return order;
  }

  async getOrderByNumber(storeId: string, orderNumber: string): Promise<OrderEntity | null> {
    return this.orderRepo.findByOrderNumber(orderNumber, storeId);
  }

  async listOrdersByCustomer(customerId: string, storeId: string, limit = 50, offset = 0): Promise<OrderEntity[]> {
    return this.orderRepo.findByCustomer(customerId, storeId, limit, offset);
  }

  async listOrdersByStatus(status: string, storeId: string, limit = 50, offset = 0): Promise<OrderEntity[]> {
    return this.orderRepo.findByStatus(status, storeId, limit, offset);
  }

  async updateOrder(storeId: string, orderId: string, dto: UpdateOrderDto): Promise<OrderEntity> {
    const order = await this.orderRepo.findByIdOrFail(orderId, storeId);

    if (dto.status) order.status = dto.status;
    if (dto.payment_status) order.payment_status = dto.payment_status;
    if (dto.fulfillment_status) order.fulfillment_status = dto.fulfillment_status;
    if (dto.notes !== undefined) order.notes = dto.notes;
    if (dto.customer_notes !== undefined) order.customer_notes = dto.customer_notes;
    if (dto.payment_method) order.payment_method = dto.payment_method;
    if (dto.metadata) order.metadata = { ...order.metadata, ...dto.metadata };

    order.updated_at = new Date();

    return this.orderRepo.save(order);
  }

  async markAsPaid(storeId: string, orderId: string, dto: MarkAsPaidDto): Promise<OrderEntity> {
    if (dto.payment_method) {
      const order = await this.orderRepo.findByIdOrFail(orderId, storeId);
      order.payment_method = dto.payment_method;
      await this.orderRepo.save(order);
    }

    return this.orderRepo.markAsPaid(orderId, storeId);
  }

  async markAsShipped(storeId: string, orderId: string, dto: MarkAsShippedDto): Promise<OrderEntity> {
    const order = await this.orderRepo.markAsShipped(orderId, storeId);

    if (dto.tracking_number || dto.carrier) {
      order.metadata = {
        ...order.metadata,
        tracking_number: dto.tracking_number,
        carrier: dto.carrier,
      };
      await this.orderRepo.save(order);
    }

    return order;
  }

  async cancelOrder(storeId: string, orderId: string, reason?: string): Promise<OrderEntity> {
    const order = await this.orderRepo.findByIdOrFail(orderId, storeId);

    if (order.status === 'cancelled') {
      throw new Error('Order is already cancelled');
    }

    order.metadata = { ...order.metadata, cancellation_reason: reason };
    await this.orderRepo.save(order);

    return this.orderRepo.cancelOrder(orderId, storeId);
  }

  async getPendingOrders(storeId: string): Promise<OrderEntity[]> {
    return this.orderRepo.getPendingOrders(storeId);
  }

  async getTotalRevenue(storeId: string): Promise<number> {
    return this.orderRepo.getTotalRevenue(storeId);
  }
}

/**
 * Order Line Service
 */
export class OrderLineService {
  constructor(private lineRepo: OrderLineRepository) {}

  async getLinesByOrder(orderId: string, storeId: string): Promise<OrderLineEntity[]> {
    return this.lineRepo.findByOrderId(orderId, storeId);
  }

  async getUnfulfilledLines(storeId: string): Promise<OrderLineEntity[]> {
    return this.lineRepo.getUnfulfilledLines(storeId);
  }

  async updateLine(
    storeId: string,
    lineId: string,
    dto: UpdateOrderLineDto
  ): Promise<OrderLineEntity> {
    const line = await this.lineRepo.findByIdOrFail(lineId, storeId);

    if (dto.quantity !== undefined) {
      line.quantity = dto.quantity;
      line.line_total = dto.quantity * line.unit_price;
    }

    if (dto.fulfillment_status) {
      line.fulfillment_status = dto.fulfillment_status;
    }

    if (dto.metadata) {
      line.metadata = { ...line.metadata, ...dto.metadata };
    }

    line.updated_at = new Date();

    return this.lineRepo.save(line);
  }

  async fulfillLine(storeId: string, lineId: string, dto: FulfillLineDto): Promise<OrderLineEntity> {
    const line = await this.lineRepo.findByIdOrFail(lineId, storeId);

    if (dto.quantity) {
      line.quantity = dto.quantity;
      line.line_total = dto.quantity * line.unit_price;
    }

    return this.lineRepo.markAsFulfilled(lineId, storeId);
  }

  async getLinesByVariant(variantId: string, storeId: string): Promise<OrderLineEntity[]> {
    return this.lineRepo.getLinesByVariant(variantId, storeId);
  }
}
