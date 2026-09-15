/**
 * Order Management Repositories
 * Order and OrderLine repositories with store isolation
 *
 * Phase 5: Order Management Domain
 */

import { BaseRepository } from '../repository/base-repository';
import { OrderEntity } from '../entities/order.entity';
import { OrderLineEntity } from '../entities/order-line.entity';

/**
 * Order Repository
 */
export class OrderRepository extends BaseRepository<OrderEntity> {
  constructor() {
    super(OrderEntity);
  }

  async findByOrderNumber(orderNumber: string, storeId: string): Promise<OrderEntity | null> {
    return this.repository.findOne({
      where: { order_number: orderNumber, store_id: storeId } as any,
      relations: ['lines'],
    });
  }

  async findByCustomer(customerId: string, storeId: string, limit = 50, offset = 0): Promise<OrderEntity[]> {
    return this.repository.find({
      where: { customer_id: customerId, store_id: storeId } as any,
      relations: ['lines'],
      order: { created_at: 'DESC' } as any,
      skip: offset,
      take: limit,
    });
  }

  async findByStatus(status: string, storeId: string, limit = 50, offset = 0): Promise<OrderEntity[]> {
    return this.repository.find({
      where: { status, store_id: storeId } as any,
      relations: ['lines'],
      order: { created_at: 'DESC' } as any,
      skip: offset,
      take: limit,
    });
  }

  async findByPaymentStatus(paymentStatus: string, storeId: string, limit = 50, offset = 0): Promise<OrderEntity[]> {
    return this.repository.find({
      where: { payment_status: paymentStatus, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
      skip: offset,
      take: limit,
    });
  }

  async findByFulfillmentStatus(
    fulfillmentStatus: string,
    storeId: string,
    limit = 50,
    offset = 0
  ): Promise<OrderEntity[]> {
    return this.repository.find({
      where: { fulfillment_status: fulfillmentStatus, store_id: storeId } as any,
      relations: ['lines'],
      order: { created_at: 'DESC' } as any,
      skip: offset,
      take: limit,
    });
  }

  async getNextOrderNumber(storeId: string): Promise<string> {
    const lastOrder = await this.repository.findOne({
      where: { store_id: storeId } as any,
      order: { order_number: 'DESC' } as any,
    });

    if (!lastOrder) {
      return 'ORD-0001';
    }

    // Parse order number (e.g., "ORD-00123" -> 123)
    const match = lastOrder.order_number.match(/\d+$/);
    if (!match) {
      return 'ORD-0001';
    }

    const lastNumber = parseInt(match[0]);
    const nextNumber = lastNumber + 1;

    // Pad with zeros (5 digits for ORD-00001)
    return `ORD-${String(nextNumber).padStart(5, '0')}`;
  }

  async getPendingOrders(storeId: string): Promise<OrderEntity[]> {
    return this.repository.find({
      where: { status: 'pending', store_id: storeId } as any,
      relations: ['lines'],
      order: { created_at: 'ASC' } as any,
    });
  }

  async countByStatus(status: string, storeId: string): Promise<number> {
    return this.repository.count({
      where: { status, store_id: storeId } as any,
    });
  }

  async getTotalRevenue(storeId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('o')
      .where('o.store_id = :storeId', { storeId })
      .andWhere('o.payment_status = :paymentStatus', { paymentStatus: 'paid' })
      .select('COALESCE(SUM(o.total), 0)', 'revenue')
      .getRawOne();

    return parseFloat(result?.revenue || 0);
  }

  async updateStatus(orderId: string, storeId: string, status: string): Promise<OrderEntity> {
    await this.repository.update(
      { id: orderId, store_id: storeId } as any,
      { status, updated_at: new Date() }
    );

    return this.findByIdOrFail(orderId, storeId);
  }

  async markAsPaid(orderId: string, storeId: string): Promise<OrderEntity> {
    await this.repository.update(
      { id: orderId, store_id: storeId } as any,
      { payment_status: 'paid', updated_at: new Date() }
    );

    return this.findByIdOrFail(orderId, storeId);
  }

  async markAsShipped(orderId: string, storeId: string): Promise<OrderEntity> {
    await this.repository.update(
      { id: orderId, store_id: storeId } as any,
      { status: 'shipped', updated_at: new Date() }
    );

    return this.findByIdOrFail(orderId, storeId);
  }

  async cancelOrder(orderId: string, storeId: string): Promise<OrderEntity> {
    await this.repository.update(
      { id: orderId, store_id: storeId } as any,
      { status: 'cancelled', cancelled_at: new Date(), updated_at: new Date() }
    );

    return this.findByIdOrFail(orderId, storeId);
  }
}

/**
 * Order Line Repository
 */
export class OrderLineRepository extends BaseRepository<OrderLineEntity> {
  constructor() {
    super(OrderLineEntity);
  }

  async findByOrderId(orderId: string, storeId: string): Promise<OrderLineEntity[]> {
    return this.repository.find({
      where: { order_id: orderId, store_id: storeId } as any,
      order: { created_at: 'ASC' } as any,
    });
  }

  async findByProductVariant(variantId: string, storeId: string, limit = 50): Promise<OrderLineEntity[]> {
    return this.repository.find({
      where: { product_variant_id: variantId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
      take: limit,
    });
  }

  async getUnfulfilledLines(storeId: string): Promise<OrderLineEntity[]> {
    return this.repository.find({
      where: { fulfillment_status: 'unfulfilled', store_id: storeId } as any,
      order: { created_at: 'ASC' } as any,
    });
  }

  async markAsFulfilled(lineId: string, storeId: string): Promise<OrderLineEntity> {
    await this.repository.update(
      { id: lineId, store_id: storeId } as any,
      { fulfillment_status: 'fulfilled', updated_at: new Date() }
    );

    const line = await this.repository.findOne({
      where: { id: lineId, store_id: storeId } as any,
    });

    if (!line) {
      throw new Error('Order line not found');
    }

    return line;
  }

  async getLinesByVariant(variantId: string, storeId: string): Promise<OrderLineEntity[]> {
    return this.repository.find({
      where: { product_variant_id: variantId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
    });
  }
}
