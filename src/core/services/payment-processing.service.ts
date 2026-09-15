/**
 * Payment Processing Service
 * Orchestrates payment lifecycle management
 *
 * Phase 9: Payment Processing
 */

import { PaymentEntity } from '../entities/payment.entity';
import { RefundEntity } from '../entities/refund.entity';
import { PaymentRepository, RefundRepository } from '../repositories/payment.repositories';
import { RazorpayIntegrationService } from './razorpay-integration.service';
import {
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  CapturePaymentDto,
  RazorpayPaymentDto,
} from '../dtos/payment.dto';

/**
 * Payment Processing Service
 * Manages complete payment lifecycle with Razorpay
 */
export class PaymentProcessingService {
  constructor(
    private paymentRepo: PaymentRepository,
    private refundRepo: RefundRepository,
    private razorpay: RazorpayIntegrationService
  ) {}

  /**
   * Create Payment Intent
   * Initiates payment process by creating Razorpay order
   */
  async createPaymentIntent(storeId: string, dto: CreatePaymentIntentDto): Promise<PaymentEntity> {
    try {
      // Create Razorpay order
      const razorpayOrder = await this.razorpay.createOrder(
        dto.amount,
        dto.currency || 'INR',
        dto.order_id,
        dto.metadata
      );

      // Create local payment record
      const payment = new PaymentEntity();
      payment.id = crypto.randomUUID();
      payment.store_id = storeId;
      payment.customer_id = dto.customer_id;
      payment.order_id = dto.order_id;
      payment.razorpay_order_id = razorpayOrder.id;
      payment.amount = dto.amount;
      payment.currency = dto.currency || 'INR';
      payment.status = 'pending';
      payment.payment_method = 'razorpay';
      payment.metadata = {
        ...(dto.metadata || {}),
        created_at: new Date().toISOString(),
      };

      return this.paymentRepo.save(payment);
    } catch (error) {
      throw new Error(`Failed to create payment intent: ${(error as Error).message}`);
    }
  }

  /**
   * Confirm Payment
   * Called after customer completes Razorpay checkout
   */
  async confirmPayment(storeId: string, dto: ConfirmPaymentDto): Promise<PaymentEntity> {
    try {
      // Find existing payment
      const payment = await this.paymentRepo.findByIdOrFail(dto.payment_id, storeId);

      // Fetch actual payment details from Razorpay
      const razorpayPayment = await this.razorpay.getPayment(dto.razorpay_payment_id);

      // Validate amount matches
      if (razorpayPayment.amount / 100 !== payment.amount) {
        throw new Error('Payment amount mismatch');
      }

      // Update payment record
      payment.razorpay_payment_id = dto.razorpay_payment_id;
      payment.razorpay_order_id = dto.razorpay_order_id || razorpayPayment.order_id;
      payment.status = razorpayPayment.status === 'captured' ? 'captured' : 'authorized';
      payment.payment_method_type = dto.payment_method_type;
      payment.last_four = razorpayPayment.card?.last4;
      payment.card_brand = razorpayPayment.card?.network;
      payment.risk_rating = razorpayPayment.risk?.signal;
      payment.risk_reason = razorpayPayment.risk?.reason;

      if (razorpayPayment.status === 'failed') {
        payment.status = 'failed';
        payment.error_code = razorpayPayment.error_code;
        payment.error_message = razorpayPayment.error_description;
      }

      payment.metadata = {
        ...(payment.metadata || {}),
        razorpay_response: razorpayPayment,
        confirmed_at: new Date().toISOString(),
      };

      return this.paymentRepo.save(payment);
    } catch (error) {
      throw new Error(`Failed to confirm payment: ${(error as Error).message}`);
    }
  }

  /**
   * Capture Payment
   * Captures an authorized payment (for split auth/capture flows)
   */
  async capturePayment(storeId: string, dto: CapturePaymentDto): Promise<PaymentEntity> {
    try {
      const payment = await this.paymentRepo.findByIdOrFail(dto.payment_id, storeId);

      if (!payment.razorpay_payment_id) {
        throw new Error('Payment has no Razorpay ID');
      }

      if (payment.status !== 'authorized') {
        throw new Error('Only authorized payments can be captured');
      }

      // Capture with Razorpay
      const razorpayPayment = await this.razorpay.capturePayment(
        payment.razorpay_payment_id,
        dto.amount
      );

      payment.status = 'captured';
      payment.metadata = {
        ...(payment.metadata || {}),
        captured_at: new Date().toISOString(),
        capture_amount: dto.amount,
      };

      return this.paymentRepo.save(payment);
    } catch (error) {
      throw new Error(`Failed to capture payment: ${(error as Error).message}`);
    }
  }

  /**
   * Get Payment
   * Retrieve payment details
   */
  async getPayment(storeId: string, paymentId: string): Promise<PaymentEntity> {
    return this.paymentRepo.findByIdOrFail(paymentId, storeId);
  }

  /**
   * List Payments
   * Get customer's payment history
   */
  async listPayments(
    storeId: string,
    customerId: string,
    limit = 50,
    offset = 0
  ): Promise<{ payments: PaymentEntity[]; total: number }> {
    const payments = await this.paymentRepo.findByCustomer(customerId, storeId, limit, offset);
    const total = await this.paymentRepo.countByStatus('captured', storeId); // Approximate

    return { payments, total };
  }

  /**
   * Update Payment Status
   * Called by webhook handler to update payment status
   */
  async updatePaymentStatus(
    storeId: string,
    paymentId: string,
    status: string,
    razorpayData?: RazorpayPaymentDto
  ): Promise<PaymentEntity> {
    const payment = await this.paymentRepo.findByIdOrFail(paymentId, storeId);

    payment.status = status as any;

    if (razorpayData) {
      payment.razorpay_payment_id = razorpayData.id;
      payment.last_four = razorpayData.card?.last4;
      payment.card_brand = razorpayData.card?.network;
      payment.risk_rating = razorpayData.risk?.signal;
      payment.error_code = razorpayData.error_code;
      payment.error_message = razorpayData.error_description;
      payment.metadata = {
        ...(payment.metadata || {}),
        webhook_update: new Date().toISOString(),
      };
    }

    payment.updated_at = new Date();

    return this.paymentRepo.save(payment);
  }

  /**
   * Validate Refund Eligibility
   * Check if a payment can be refunded
   */
  async validateRefundEligibility(
    storeId: string,
    paymentId: string
  ): Promise<{ eligible: boolean; maxAmount: number; reason?: string }> {
    const payment = await this.paymentRepo.findByIdOrFail(paymentId, storeId);

    if (payment.status !== 'captured') {
      return {
        eligible: false,
        maxAmount: 0,
        reason: 'Only captured payments can be refunded',
      };
    }

    // Get total already refunded
    const totalRefunded = await this.refundRepo.getTotalRefunded(paymentId, storeId);

    const maxRefundAmount = Math.max(0, payment.amount - totalRefunded);

    if (maxRefundAmount <= 0) {
      return {
        eligible: false,
        maxAmount: 0,
        reason: 'Payment already fully refunded',
      };
    }

    return {
      eligible: true,
      maxAmount: maxRefundAmount,
    };
  }

  /**
   * Request Refund
   * Create a refund request (pending admin approval)
   */
  async requestRefund(
    storeId: string,
    paymentId: string,
    orderId: string,
    amount?: number,
    reason?: string,
    notes?: string
  ): Promise<RefundEntity> {
    // Validate eligibility
    const eligibility = await this.validateRefundEligibility(storeId, paymentId);

    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || 'Refund not eligible');
    }

    const refundAmount = amount || eligibility.maxAmount;

    if (refundAmount > eligibility.maxAmount) {
      throw new Error(`Refund amount exceeds maximum of ${eligibility.maxAmount}`);
    }

    // Create refund request
    const refund = new RefundEntity();
    refund.id = crypto.randomUUID();
    refund.store_id = storeId;
    refund.payment_id = paymentId;
    refund.order_id = orderId;
    refund.amount = refundAmount;
    refund.reason = reason || 'general';
    refund.status = 'pending_approval';
    refund.metadata = {
      notes,
      requested_at: new Date().toISOString(),
    };

    return this.refundRepo.save(refund);
  }

  /**
   * Process Approved Refund
   * Called after admin approval to process with Razorpay
   */
  async processApprovedRefund(storeId: string, refundId: string): Promise<RefundEntity> {
    const refund = await this.refundRepo.findByIdOrFail(refundId, storeId);

    if (refund.status !== 'approved') {
      throw new Error('Only approved refunds can be processed');
    }

    const payment = await this.paymentRepo.findByIdOrFail(refund.payment_id, storeId);

    if (!payment.razorpay_payment_id) {
      throw new Error('Payment has no Razorpay ID');
    }

    try {
      // Create refund with Razorpay
      const razorpayRefund = await this.razorpay.createRefund(
        payment.razorpay_payment_id,
        refund.amount,
        { order_id: refund.order_id, reason: refund.reason }
      );

      // Update refund record
      refund.razorpay_refund_id = razorpayRefund.id;
      refund.status = razorpayRefund.status === 'processed' ? 'succeeded' : 'pending_approval';
      refund.metadata = {
        ...(refund.metadata || {}),
        razorpay_refund_id: razorpayRefund.id,
        processed_at: new Date().toISOString(),
      };

      return this.refundRepo.save(refund);
    } catch (error) {
      refund.status = 'failed';
      refund.metadata = {
        ...(refund.metadata || {}),
        error: (error as Error).message,
        failed_at: new Date().toISOString(),
      };

      return this.refundRepo.save(refund);
    }
  }

  /**
   * List Pending Refunds
   * For admin dashboard
   */
  async listPendingRefunds(storeId: string, limit = 50): Promise<RefundEntity[]> {
    return this.refundRepo.findPending(storeId, limit);
  }

  /**
   * Get Pending Refund Count
   * For dashboard metrics
   */
  async getPendingRefundCount(storeId: string): Promise<number> {
    return this.refundRepo.countPending(storeId);
  }
}
