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
 * Order number format.
 *
 * ORDER_NUMBER_MIN_DIGITS is 4 because every existing order uses four
 * (ORD-1001 … ORD-1026). It is a *minimum*, not a fixed width: past ORD-9999
 * the numbers simply grow to five digits, which is safe now that nothing sorts
 * or compares them as strings. The previous code padded to five while the data
 * used four, and that mismatch is what broke ordering.
 */
const ORDER_NUMBER_PREFIX = 'ORD-';
const ORDER_NUMBER_MIN_DIGITS = 4;

/**
 * The numeric tail of an order number, as SQL.
 *
 * Kept in one place because getting it wrong is silent: comparing order_number
 * directly is a string comparison, which is exactly the bug this replaces.
 */
const ORDER_NUMBER_SQL_SUFFIX = `CAST(substring(order_number from '[0-9]+$') AS integer)`;

/** Render an allocated counter value as a customer-facing order number. */
export function formatOrderNumber(value: number): string {
  return `${ORDER_NUMBER_PREFIX}${String(value).padStart(ORDER_NUMBER_MIN_DIGITS, '0')}`;
}

/**
 * Read the numeric tail back out of an order number.
 * Returns null for anything that does not end in digits, so callers decide
 * what to do rather than silently receiving NaN.
 */
export function parseOrderNumber(orderNumber: string): number | null {
  const match = /(\d+)$/.exec(orderNumber);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(value) ? value : null;
}

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

  /**
   * Reserve the next order number for a store.
   *
   * This previously read MAX from `orders` and added one, which was broken in
   * two ways that combined into a permanent outage:
   *
   *   - It picked the "last" order with `order_number DESC`, a *string* sort.
   *   - It padded to five digits while every existing row used four.
   *
   * So the first new order became ORD-01027. On the next call the string sort
   * still returned ORD-1026 — 'ORD-1026' > 'ORD-01027' lexically, because '1'
   * beats '0' at the fifth character — and it computed ORD-01027 again, which
   * idx_orders_number rejects. Every order after the first would have failed.
   *
   * Both halves are fixed here: the counter is a real integer, so no string
   * ordering is involved anywhere, and formatting is centralised in
   * formatOrderNumber with a width that matches the existing data.
   *
   * It is also no longer a read-then-write. The upsert below increments under
   * a row lock and returns the value it reserved, so concurrent checkouts get
   * distinct numbers instead of racing for the same one.
   */
  async getNextOrderNumber(storeId: string): Promise<string> {
    const rows = await this.repository.manager.query(
      `
      INSERT INTO order_number_counters AS c (store_id, next_value)
      SELECT
        $1,
        -- Seed on first use from the highest number this store actually has,
        -- read numerically. +2 because the row stores the *next* number to
        -- hand out and this statement is simultaneously handing out the first.
        COALESCE(MAX(${ORDER_NUMBER_SQL_SUFFIX}), 0) + 2
      FROM orders
      WHERE store_id = $1
      ON CONFLICT (store_id) DO UPDATE
        SET next_value = c.next_value + 1,
            updated_at = now()
      RETURNING c.next_value - 1 AS allocated
      `,
      [storeId],
    );

    const allocated = Number(rows?.[0]?.allocated);
    if (!Number.isInteger(allocated) || allocated < 1) {
      throw new Error(`Could not allocate an order number for store ${storeId}`);
    }

    return formatOrderNumber(allocated);
  }

  /**
   * Realign the counter with the orders table.
   *
   * The counter is the allocator, but `orders` is the source of truth. They can
   * drift — a restored backup, a row inserted by hand, a seed script — and the
   * symptom is a unique-violation on insert. Raising the counter to just past
   * the highest real order number clears that without ever moving it backwards,
   * which would hand out a number twice.
   */
  async resyncOrderNumberCounter(storeId: string): Promise<void> {
    await this.repository.manager.query(
      `
      INSERT INTO order_number_counters AS c (store_id, next_value)
      SELECT $1, COALESCE(MAX(${ORDER_NUMBER_SQL_SUFFIX}), 0) + 1
      FROM orders
      WHERE store_id = $1
      ON CONFLICT (store_id) DO UPDATE
        SET next_value = GREATEST(
              c.next_value,
              (SELECT COALESCE(MAX(${ORDER_NUMBER_SQL_SUFFIX}), 0) + 1
                 FROM orders WHERE store_id = $1)
            ),
            updated_at = now()
      `,
      [storeId],
    );
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
