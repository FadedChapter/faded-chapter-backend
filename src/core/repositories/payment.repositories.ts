/**
 * Payment & Refund Repositories
 * Repository layer for payment and refund management
 *
 * Phase 9: Payment Processing
 */

import { BaseRepository } from '../repository/base-repository';
import { PaymentEntity } from '../entities/payment.entity';
import { RefundEntity } from '../entities/refund.entity';

/**
 * Payment Repository
 */
export class PaymentRepository extends BaseRepository<PaymentEntity> {
  constructor() {
    super(PaymentEntity);
  }

  // ==========================================================================
  // Operations console (Phase 6)
  // ==========================================================================

  /**
   * Transactions list.
   *
   * Joins the order so a row can be read without a second lookup: a payment id
   * means nothing to an operator, whereas an order number is what a customer
   * quotes and what every other console keys on.
   *
   * store_id is applied unconditionally as the first predicate.
   */
  async searchPayments(
    storeId: string,
    options: {
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ rows: PaymentTransactionRow[]; total: number }> {
    const { status, search, limit = 25, offset = 0 } = options;

    const build = () => {
      const qb = this.repository
        .createQueryBuilder('p')
        .leftJoin('orders', 'o', 'o.id = p.order_id AND o.store_id = p.store_id')
        .where('p.store_id = :storeId', { storeId });

      if (status) qb.andWhere('p.status = :status', { status });

      if (search?.trim()) {
        // An operator searching a payment is holding either the order number
        // from a customer, or the gateway reference from a reconciliation
        // report. Both are matched; parameterised, never interpolated.
        const term = `%${search.trim()}%`;
        qb.andWhere(
          '(o.order_number ILIKE :term OR p.razorpay_payment_id ILIKE :term ' +
            "OR o.shipping_address->>'name' ILIKE :term)",
          { term },
        );
      }
      return qb;
    };

    const total = await build().getCount();

    const rows = await build()
      .select([
        'p.id AS id',
        'p.order_id AS "orderId"',
        'o.order_number AS "orderNumber"',
        "o.shipping_address->>'name' AS \"customerName\"",
        'p.amount AS amount',
        'p.currency AS currency',
        'p.status AS status',
        'p.payment_method_type AS "paymentMethodType"',
        'p.last_four AS "lastFour"',
        'p.card_brand AS "cardBrand"',
        'p.error_code AS "errorCode"',
        'p.risk_rating AS "riskRating"',
        'p.razorpay_payment_id AS "gatewayPaymentId"',
        'p.created_at AS "createdAt"',
      ])
      .orderBy('p.created_at', 'DESC')
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0))
      .getRawMany<PaymentTransactionRow>();

    return { rows, total };
  }

  /**
   * Status counts plus money in and money out.
   *
   * Two different sources, deliberately:
   *
   *  - Counts and captured value come from `payments`, which is the ledger of
   *    what the gateway took.
   *  - Refunded value comes from approved rows in `refunds`, NOT from payments
   *    whose status is 'refunded'.
   *
   * The distinction matters and was got wrong first time. Approving a refund
   * updates the refund row; it does not restate the payment, which stays
   * 'captured' because the gateway did capture it. Summing payments by a
   * 'refunded' status therefore produces a figure that neither equals the money
   * refunded nor moves when a refund is approved — a total sitting next to an
   * Approve button that never responds to it.
   *
   * Summing both sources would double-count a payment that is marked refunded
   * and also has refund rows, so `refunds` is the single source of truth for
   * money going out.
   */
  async transactionSummary(storeId: string): Promise<{
    counts: Record<string, number>;
    capturedValue: number;
    refundedValue: number;
  }> {
    const rows = await this.repository
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'value')
      .where('p.store_id = :storeId', { storeId })
      .groupBy('p.status')
      .getRawMany<{ status: string; count: string; value: string }>();

    const counts: Record<string, number> = {};
    let capturedValue = 0;

    for (const row of rows) {
      counts[row.status] = Number(row.count);
      // 'refunded' payments were still captured — the money was taken before
      // it was given back — so they count toward money in.
      if (row.status === 'captured' || row.status === 'refunded') {
        capturedValue += Number(row.value);
      }
    }

    const refundRow = await this.repository.manager
      .createQueryBuilder()
      .select('COALESCE(SUM(r.amount), 0)', 'value')
      .from('refunds', 'r')
      .where('r.store_id = :storeId', { storeId })
      // Only approved refunds are money that actually left. Pending ones are a
      // decision not yet made, and rejected ones never happened.
      .andWhere("r.status = 'approved'")
      .getRawOne<{ value: string }>();

    return {
      counts,
      capturedValue,
      refundedValue: Number(refundRow?.value ?? 0),
    };
  }

  /** One payment, scoped to store. */
  async findOneScoped(paymentId: string, storeId: string): Promise<PaymentEntity | null> {
    return this.repository.findOne({
      where: { id: paymentId, store_id: storeId } as any,
    });
  }

  async findByOrder(orderId: string, storeId: string): Promise<PaymentEntity | null> {
    return this.repository.findOne({
      where: { order_id: orderId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
    });
  }

  async findByCustomer(
    customerId: string,
    storeId: string,
    limit = 50,
    offset = 0
  ): Promise<PaymentEntity[]> {
    return this.repository.find({
      where: { customer_id: customerId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
      take: limit,
      skip: offset,
    });
  }

  async findByRazorpayId(razorpayPaymentId: string, storeId: string): Promise<PaymentEntity | null> {
    return this.repository.findOne({
      where: { razorpay_payment_id: razorpayPaymentId, store_id: storeId } as any,
    });
  }

  async findByRazorpayOrderId(razorpayOrderId: string, storeId: string): Promise<PaymentEntity | null> {
    return this.repository.findOne({
      where: { razorpay_order_id: razorpayOrderId, store_id: storeId } as any,
    });
  }

  async findByStatus(
    status: string,
    storeId: string,
    limit = 50,
    offset = 0
  ): Promise<PaymentEntity[]> {
    return this.repository.find({
      where: { status: status as any, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
      take: limit,
      skip: offset,
    });
  }

  async update(id: string, storeId: string, data: Partial<PaymentEntity>): Promise<PaymentEntity> {
    const payment = await this.findByIdOrFail(id, storeId);
    Object.assign(payment, data);
    payment.updated_at = new Date();
    return this.save(payment);
  }

  async findByIdOrFail(id: string, storeId: string): Promise<PaymentEntity> {
    const payment = await this.repository.findOne({
      where: { id, store_id: storeId } as any,
    });
    if (!payment) {
      throw new Error(`Payment ${id} not found for store ${storeId}`);
    }
    return payment;
  }

  async countByStatus(status: string, storeId: string): Promise<number> {
    return this.repository.count({
      where: { status: status as any, store_id: storeId } as any,
    });
  }

  async findByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<PaymentEntity[]> {
    return this.repository
      .createQueryBuilder('p')
      .where('p.store_id = :storeId', { storeId })
      .andWhere('p.created_at >= :startDate', { startDate })
      .andWhere('p.created_at <= :endDate', { endDate })
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }
}

/**
 * Refund Repository
 */
export class RefundRepository extends BaseRepository<RefundEntity> {
  constructor() {
    super(RefundEntity);
  }

  /**
   * One refund, scoped to store.
   * Store scoping is part of the lookup so a mismatched store yields
   * "not found" rather than another store's refund.
   */
  async findOneScoped(refundId: string, storeId: string): Promise<RefundEntity | null> {
    return this.repository.findOne({
      where: { id: refundId, store_id: storeId } as any,
    });
  }

  /** Refunds attached to a set of payments, for the transactions list. */
  async findByPaymentIds(paymentIds: string[], storeId: string): Promise<RefundEntity[]> {
    if (paymentIds.length === 0) return [];
    return this.repository
      .createQueryBuilder('r')
      .where('r.store_id = :storeId', { storeId })
      .andWhere('r.payment_id IN (:...paymentIds)', { paymentIds })
      .orderBy('r.created_at', 'DESC')
      .getMany();
  }

  async findByPayment(paymentId: string, storeId: string): Promise<RefundEntity[]> {
    return this.repository.find({
      where: { payment_id: paymentId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
    });
  }

  async findByOrder(orderId: string, storeId: string): Promise<RefundEntity[]> {
    return this.repository.find({
      where: { order_id: orderId, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
    });
  }

  async findByStatus(status: string, storeId: string, limit = 50, offset = 0): Promise<RefundEntity[]> {
    return this.repository.find({
      where: { status: status as any, store_id: storeId } as any,
      order: { created_at: 'DESC' } as any,
      take: limit,
      skip: offset,
    });
  }

  async findPending(storeId: string, limit = 50): Promise<RefundEntity[]> {
    return this.repository.find({
      where: { status: 'pending_approval' as any, store_id: storeId } as any,
      order: { created_at: 'ASC' } as any, // Oldest first
      take: limit,
    });
  }

  async getTotalRefunded(paymentId: string, storeId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('r')
      .where('r.payment_id = :paymentId', { paymentId })
      .andWhere('r.store_id = :storeId', { storeId })
      .andWhere('r.status = :status', { status: 'succeeded' })
      .select('COALESCE(SUM(r.amount), 0)', 'total')
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  async update(id: string, storeId: string, data: Partial<RefundEntity>): Promise<RefundEntity> {
    const refund = await this.findByIdOrFail(id, storeId);
    Object.assign(refund, data);
    refund.updated_at = new Date();
    return this.save(refund);
  }

  async findByIdOrFail(id: string, storeId: string): Promise<RefundEntity> {
    const refund = await this.repository.findOne({
      where: { id, store_id: storeId } as any,
    });
    if (!refund) {
      throw new Error(`Refund ${id} not found for store ${storeId}`);
    }
    return refund;
  }

  async approve(id: string, storeId: string, approvedBy: string): Promise<RefundEntity> {
    const refund = await this.findByIdOrFail(id, storeId);
    refund.status = 'approved';
    refund.approved_by = approvedBy;
    refund.approval_date = new Date();
    refund.updated_at = new Date();
    return this.save(refund);
  }

  async reject(id: string, storeId: string, reason: string): Promise<RefundEntity> {
    const refund = await this.findByIdOrFail(id, storeId);
    refund.status = 'rejected';
    refund.approval_notes = reason;
    refund.updated_at = new Date();
    return this.save(refund);
  }

  async countPending(storeId: string): Promise<number> {
    return this.repository.count({
      where: { status: 'pending_approval' as any, store_id: storeId } as any,
    });
  }

  async countByStatus(status: string, storeId: string): Promise<number> {
    return this.repository.count({
      where: { status: status as any, store_id: storeId } as any,
    });
  }

  async countByPaymentId(paymentId: string, storeId: string): Promise<number> {
    return this.repository.count({
      where: { payment_id: paymentId, store_id: storeId } as any,
    });
  }

  async countByOrderId(orderId: string, storeId: string): Promise<number> {
    return this.repository.count({
      where: { order_id: orderId, store_id: storeId } as any,
    });
  }

  async findByRazorpayRefundId(razorpayRefundId: string, storeId: string): Promise<RefundEntity | null> {
    return this.repository.findOne({
      where: { razorpay_refund_id: razorpayRefundId, store_id: storeId } as any,
    });
  }

  async findByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<RefundEntity[]> {
    return this.repository
      .createQueryBuilder('r')
      .where('r.store_id = :storeId', { storeId })
      .andWhere('r.created_at >= :startDate', { startDate })
      .andWhere('r.created_at <= :endDate', { endDate })
      .orderBy('r.created_at', 'DESC')
      .getMany();
  }
}

/** Flat row spanning payment + order, for the transactions list. */
export interface PaymentTransactionRow {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  amount: string | number;
  currency: string;
  status: string;
  paymentMethodType: string | null;
  lastFour: string | null;
  cardBrand: string | null;
  errorCode: string | null;
  riskRating: string | null;
  gatewayPaymentId: string | null;
  createdAt: Date;
}
