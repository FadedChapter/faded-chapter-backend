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

  /**
   * Operations order search — one query covering filter + search + sort + page.
   *
   * The existing finders are single-dimension (by status, by customer, by
   * payment status) and return no total, which cannot express what an order
   * queue actually needs: "unfulfilled, paid, this month, matching 'ORD-1012',
   * page 3". Composing them client-side would mean over-fetching and paginating
   * in memory.
   *
   * store_id is applied unconditionally as the first predicate — it is not a
   * caller-supplied filter and must never be optional.
   */
  async searchOrders(
    storeId: string,
    options: {
      status?: string;
      paymentStatus?: string;
      fulfillmentStatus?: string;
      search?: string;
      from?: Date;
      to?: Date;
      sort?: 'created_at' | 'total' | 'order_number';
      direction?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ rows: OrderEntity[]; total: number; itemCounts: Map<string, number> }> {
    const {
      status,
      paymentStatus,
      fulfillmentStatus,
      search,
      from,
      to,
      sort = 'created_at',
      direction = 'DESC',
      limit = 25,
      offset = 0,
    } = options;

    const qb = this.repository
      .createQueryBuilder('o')
      .where('o.store_id = :storeId', { storeId });

    if (status) qb.andWhere('o.status = :status', { status });
    if (paymentStatus) qb.andWhere('o.payment_status = :paymentStatus', { paymentStatus });
    if (fulfillmentStatus) {
      qb.andWhere('o.fulfillment_status = :fulfillmentStatus', { fulfillmentStatus });
    }
    if (from) qb.andWhere('o.created_at >= :from', { from });
    if (to) qb.andWhere('o.created_at <= :to', { to });

    if (search?.trim()) {
      // Matches the order reference an operator reads off a support ticket, or
      // the recipient name. Parameterised — never interpolated.
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(o.order_number ILIKE :term OR o.shipping_address->>\'name\' ILIKE :term)',
        { term },
      );
    }

    // Allowlisted to keep an arbitrary caller-supplied column out of the ORDER BY.
    const sortColumn = (['created_at', 'total', 'order_number'] as const).includes(sort)
      ? sort
      : 'created_at';

    qb.orderBy(`o.${sortColumn}`, direction === 'ASC' ? 'ASC' : 'DESC')
      .take(Math.min(Math.max(limit, 1), 100))
      .skip(Math.max(offset, 0));

    const [rows, total] = await qb.getManyAndCount();

    // Item counts come from one bounded aggregate over just this page's ids,
    // rather than joining every order line into the list query. The list shows
    // a count, not the lines themselves, so fetching them would be wasted work
    // that grows with basket size.
    //
    // Returned as a separate map rather than written onto the entities: a
    // partially-populated `lines` array that holds a total instead of real
    // lines is a trap for the next reader.
    const itemCounts = new Map<string, number>();
    if (rows.length > 0) {
      const counts = await this.repository.manager
        .createQueryBuilder()
        .select('l.order_id', 'orderId')
        .addSelect('SUM(l.quantity)', 'items')
        .from('order_lines', 'l')
        .where('l.order_id IN (:...ids)', { ids: rows.map((row) => row.id) })
        .andWhere('l.store_id = :storeId', { storeId })
        .groupBy('l.order_id')
        .getRawMany<{ orderId: string; items: string }>();

      for (const row of counts) {
        itemCounts.set(row.orderId, Number(row.items));
      }
    }

    return { rows, total, itemCounts };
  }

  /**
   * Fetch one order, scoped to its store.
   *
   * store_id is part of the composite primary key and part of the lookup, so a
   * mismatched store yields "not found" rather than another store's row. Store
   * scoping is a predicate here, never a post-fetch check.
   */
  async findOneScoped(
    orderId: string,
    storeId: string,
    relations: string[] = [],
  ): Promise<OrderEntity | null> {
    // TypeORM v1 removed the string-array relations syntax and now requires the
    // object form. Converted here so callers keep the simpler array API.
    const relationsObject = relations.reduce<Record<string, boolean>>((acc, name) => {
      acc[name] = true;
      return acc;
    }, {});

    return this.repository.findOne({
      where: { id: orderId, store_id: storeId } as any,
      ...(relations.length ? { relations: relationsObject as any } : {}),
    });
  }

  /**
   * Apply a validated status transition.
   * Transition legality is decided by the caller; this records the result and
   * keeps the derived timestamps consistent with it.
   */
  async applyStatusTransition(
    orderId: string,
    storeId: string,
    status: string,
  ): Promise<OrderEntity> {
    const patch: Record<string, unknown> = { status: status as OrderEntity['status'], updated_at: new Date() };

    if (status === 'cancelled') {
      patch['cancelled_at'] = new Date();
    }
    if (status === 'delivered') {
      patch['fulfillment_status'] = 'fulfilled';
    }
    if (status === 'shipped') {
      patch['fulfillment_status'] = 'partially_fulfilled';
    }

    await this.repository.update({ id: orderId, store_id: storeId } as any, patch as any);
    const updated = await this.findOneScoped(orderId, storeId, ['lines']);
    if (!updated) {
      throw new Error(`Order ${orderId} disappeared during status transition`);
    }
    return updated;
  }

  /** Set internal operator notes. */
  async setNotes(orderId: string, storeId: string, notes: string): Promise<OrderEntity> {
    await this.repository.update(
      { id: orderId, store_id: storeId } as any,
      { notes, updated_at: new Date() } as any,
    );
    const updated = await this.findOneScoped(orderId, storeId, ['lines']);
    if (!updated) {
      throw new Error(`Order ${orderId} not found after notes update`);
    }
    return updated;
  }

  /** Status counts for the queue tabs, in one round trip rather than five. */
  async countByAllStatuses(storeId: string): Promise<Record<string, number>> {
    const rows = await this.repository
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.store_id = :storeId', { storeId })
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});
  }

  // NOTE: these finders used the string-array `relations: ['lines']` form that
  // TypeORM v1 removed, so every one of them threw at runtime. Flagged when
  // findOneScoped was added in Phase 2; fixed here in Phase 5, when
  // findByCustomer gained its first caller (the customer record's purchase
  // history).
  async findByOrderNumber(orderNumber: string, storeId: string): Promise<OrderEntity | null> {
    return this.repository.findOne({
      where: { order_number: orderNumber, store_id: storeId } as any,
      relations: { lines: true },
    });
  }

  async findByCustomer(customerId: string, storeId: string, limit = 50, offset = 0): Promise<OrderEntity[]> {
    return this.repository.find({
      where: { customer_id: customerId, store_id: storeId } as any,
      relations: { lines: true },
      order: { created_at: 'DESC' } as any,
      skip: offset,
      take: limit,
    });
  }

  async findByStatus(status: string, storeId: string, limit = 50, offset = 0): Promise<OrderEntity[]> {
    return this.repository.find({
      where: { status, store_id: storeId } as any,
      relations: { lines: true },
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
      relations: { lines: true },
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
      relations: { lines: true },
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
