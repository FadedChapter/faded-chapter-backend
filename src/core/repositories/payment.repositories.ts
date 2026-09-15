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
