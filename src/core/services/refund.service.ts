/**
 * Refund Service
 * Manages refund lifecycle with approval workflow
 *
 * Phase 9: Payment Processing
 */

import { RefundEntity } from '../entities/refund.entity';
import { PaymentEntity } from '../entities/payment.entity';
import { RefundRepository, PaymentRepository } from '../repositories/payment.repositories';
import { ApproveRefundDto, RejectRefundDto, RefundResponseDto } from '../dtos/payment.dto';

/**
 * Refund Service
 * Manages refund requests, approvals, rejections, and processing
 */
export class RefundService {
  constructor(
    private refundRepo: RefundRepository,
    private paymentRepo: PaymentRepository
  ) {}

  /**
   * Get Refund by ID
   * Retrieve single refund details
   */
  async getRefund(storeId: string, refundId: string): Promise<RefundEntity> {
    return this.refundRepo.findByIdOrFail(refundId, storeId);
  }

  /**
   * List Refunds for Payment
   * Get all refunds associated with a specific payment
   */
  async listRefundsForPayment(
    storeId: string,
    paymentId: string,
    limit = 50,
    offset = 0
  ): Promise<{ refunds: RefundEntity[]; total: number }> {
    const allRefunds = await this.refundRepo.findByPayment(paymentId, storeId);
    const refunds = allRefunds.slice(offset, offset + limit);
    const total = await this.refundRepo.countByPaymentId(paymentId, storeId);

    return { refunds, total };
  }

  /**
   * List Refunds for Order
   * Get all refunds associated with a specific order
   */
  async listRefundsForOrder(
    storeId: string,
    orderId: string,
    limit = 50,
    offset = 0
  ): Promise<{ refunds: RefundEntity[]; total: number }> {
    const allRefunds = await this.refundRepo.findByOrder(orderId, storeId);
    const refunds = allRefunds.slice(offset, offset + limit);
    const total = await this.refundRepo.countByOrderId(orderId, storeId);

    return { refunds, total };
  }

  /**
   * List Refunds by Status
   * Query refunds by their current status
   */
  async listRefundsByStatus(
    storeId: string,
    status: string,
    limit = 50,
    offset = 0
  ): Promise<{ refunds: RefundEntity[]; total: number }> {
    const refunds = await this.refundRepo.findByStatus(status, storeId, limit, offset);
    const total = await this.refundRepo.countByStatus(status, storeId);

    return { refunds, total };
  }

  /**
   * Approve Refund Request
   * Admin approves a pending refund request
   */
  async approveRefund(storeId: string, dto: ApproveRefundDto): Promise<RefundEntity> {
    const refund = await this.refundRepo.findByIdOrFail(dto.refund_id, storeId);

    if (refund.status !== 'pending_approval') {
      throw new Error(`Cannot approve refund with status '${refund.status}'`);
    }

    // Update refund to approved
    refund.status = 'approved';
    refund.approved_by = dto.approved_by;
    refund.approval_date = new Date();
    refund.approval_notes = dto.approval_notes;
    refund.metadata = {
      ...(refund.metadata || {}),
      approved_at: new Date().toISOString(),
      approved_by: dto.approved_by,
    };

    return this.refundRepo.save(refund);
  }

  /**
   * Reject Refund Request
   * Admin rejects a pending refund request
   */
  async rejectRefund(storeId: string, dto: RejectRefundDto): Promise<RefundEntity> {
    const refund = await this.refundRepo.findByIdOrFail(dto.refund_id, storeId);

    if (refund.status !== 'pending_approval') {
      throw new Error(`Cannot reject refund with status '${refund.status}'`);
    }

    // Update refund to rejected
    refund.status = 'rejected';
    refund.metadata = {
      ...(refund.metadata || {}),
      rejected_at: new Date().toISOString(),
      rejection_reason: dto.reason,
    };

    return this.refundRepo.save(refund);
  }

  /**
   * Get Refund Statistics
   * Dashboard metrics for refunds
   */
  async getRefundStatistics(storeId: string): Promise<{
    pending_approval: number;
    approved: number;
    rejected: number;
    succeeded: number;
    failed: number;
    total_refunded: number;
  }> {
    const [pending, approved, rejected, succeeded, failed] = await Promise.all([
      this.refundRepo.countByStatus('pending_approval', storeId),
      this.refundRepo.countByStatus('approved', storeId),
      this.refundRepo.countByStatus('rejected', storeId),
      this.refundRepo.countByStatus('succeeded', storeId),
      this.refundRepo.countByStatus('failed', storeId),
    ]);

    // Calculate total refunded (sum of succeeded refunds)
    const succeededRefunds = await this.refundRepo.findByStatus('succeeded', storeId, 1000, 0);
    const total_refunded = succeededRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      pending_approval: pending,
      approved,
      rejected,
      succeeded,
      failed,
      total_refunded,
    };
  }

  /**
   * Get Pending Refunds
   * For admin dashboard - refunds awaiting approval
   */
  async getPendingRefunds(storeId: string, limit = 50): Promise<RefundEntity[]> {
    return this.refundRepo.findPending(storeId, limit);
  }

  /**
   * Get Pending Refund Count
   * Dashboard metric
   */
  async getPendingRefundCount(storeId: string): Promise<number> {
    return this.refundRepo.countPending(storeId);
  }

  /**
   * Convert Refund Entity to Response DTO
   * Formats refund for API response
   */
  toResponseDto(refund: RefundEntity): RefundResponseDto {
    return {
      id: refund.id,
      store_id: refund.store_id,
      payment_id: refund.payment_id,
      order_id: refund.order_id,
      razorpay_refund_id: refund.razorpay_refund_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      approved_by: refund.approved_by,
      approval_date: refund.approval_date,
      approval_notes: refund.approval_notes,
      metadata: refund.metadata,
      created_at: refund.created_at,
      updated_at: refund.updated_at,
    };
  }
}
