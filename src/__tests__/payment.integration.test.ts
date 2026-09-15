/**
 * Payment Processing Integration Tests
 * Comprehensive test suite for payment lifecycle and webhooks
 *
 * Phase 9: Payment Processing - Phase 9e Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentEntity } from '../entities/payment.entity.js';
import { RefundEntity } from '../entities/refund.entity.js';
import { PaymentRepository, RefundRepository } from '../repositories/payment.repositories.js';
import { PaymentProcessingService } from '../services/payment-processing.service.js';
import { RefundService } from '../services/refund.service.js';
import { WebhookHandlerService } from '../services/webhook-handler.service.js';
import { RazorpayIntegrationService } from '../services/razorpay-integration.service.js';
import { CreatePaymentIntentDto, ConfirmPaymentDto, RazorpayWebhookDto } from '../dtos/payment.dto.js';

// Mock Razorpay service
const mockRazorpay = {
  createOrder: vi.fn(),
  getPayment: vi.fn(),
  capturePayment: vi.fn(),
  createRefund: vi.fn(),
  getRefund: vi.fn(),
  validateWebhookSignature: vi.fn(),
  parseWebhook: vi.fn(),
  validateCredentials: vi.fn(),
} as any;

// Mock repositories
const mockPaymentRepo = {
  save: vi.fn(),
  findByIdOrFail: vi.fn(),
  findByRazorpayId: vi.fn(),
  findByRazorpayOrderId: vi.fn(),
  findByCustomer: vi.fn(),
  countByStatus: vi.fn(),
  update: vi.fn(),
} as any;

const mockRefundRepo = {
  save: vi.fn(),
  findByIdOrFail: vi.fn(),
  findByRazorpayRefundId: vi.fn(),
  findByPayment: vi.fn(),
  findByOrder: vi.fn(),
  findByStatus: vi.fn(),
  findPending: vi.fn(),
  getTotalRefunded: vi.fn(),
  countByStatus: vi.fn(),
  countByPaymentId: vi.fn(),
  countByOrderId: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  countPending: vi.fn(),
} as any;

describe('Payment Processing Integration Tests', () => {
  let paymentService: PaymentProcessingService;
  let refundService: RefundService;
  let webhookService: WebhookHandlerService;

  const storeId = 'store-uuid-001';
  const customerId = 'customer-uuid-001';
  const orderId = 'order-uuid-001';

  beforeEach(() => {
    vi.clearAllMocks();
    paymentService = new PaymentProcessingService(mockPaymentRepo, mockRefundRepo, mockRazorpay);
    refundService = new RefundService(mockRefundRepo, mockPaymentRepo);
    webhookService = new WebhookHandlerService(mockPaymentRepo, mockRefundRepo, mockRazorpay);
  });

  describe('Payment Lifecycle', () => {
    describe('createPaymentIntent', () => {
      it('should create payment intent successfully', async () => {
        const dto: CreatePaymentIntentDto = {
          order_id: orderId,
          customer_id: customerId,
          amount: 1000,
          currency: 'INR',
          metadata: { items: 5 },
        };

        mockRazorpay.createOrder.mockResolvedValue({
          id: 'order_razorpay_001',
          amount: 100000,
          currency: 'INR',
          status: 'created',
          created_at: Date.now(),
        });

        mockPaymentRepo.save.mockResolvedValue({
          id: 'payment-uuid-001',
          store_id: storeId,
          customer_id: customerId,
          order_id: orderId,
          razorpay_order_id: 'order_razorpay_001',
          amount: 1000,
          currency: 'INR',
          status: 'pending',
          payment_method: 'razorpay',
          metadata: expect.any(Object),
        });

        const result = await paymentService.createPaymentIntent(storeId, dto);

        expect(result.status).toBe('pending');
        expect(result.razorpay_order_id).toBe('order_razorpay_001');
        expect(mockRazorpay.createOrder).toHaveBeenCalledWith(
          1000,
          'INR',
          orderId,
          expect.any(Object)
        );
        expect(mockPaymentRepo.save).toHaveBeenCalled();
      });

      it('should handle Razorpay API errors', async () => {
        const dto: CreatePaymentIntentDto = {
          order_id: orderId,
          customer_id: customerId,
          amount: 1000,
        };

        mockRazorpay.createOrder.mockRejectedValue(new Error('API Error: Invalid amount'));

        await expect(paymentService.createPaymentIntent(storeId, dto)).rejects.toThrow(
          'Failed to create payment intent'
        );
      });
    });

    describe('confirmPayment', () => {
      it('should confirm payment after checkout', async () => {
        const dto: ConfirmPaymentDto = {
          payment_id: 'payment-uuid-001',
          razorpay_payment_id: 'pay_razorpay_001',
          razorpay_order_id: 'order_razorpay_001',
          payment_method_type: 'card',
        };

        const existingPayment = new PaymentEntity();
        existingPayment.id = 'payment-uuid-001';
        existingPayment.store_id = storeId;
        existingPayment.amount = 1000;
        existingPayment.status = 'pending';

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(existingPayment);

        mockRazorpay.getPayment.mockResolvedValue({
          id: 'pay_razorpay_001',
          order_id: 'order_razorpay_001',
          amount: 100000,
          currency: 'INR',
          status: 'captured',
          method: 'card',
          card: {
            last4: '4242',
            network: 'Visa',
          },
          risk: {
            signal: 'safe',
          },
        });

        mockPaymentRepo.save.mockResolvedValue({
          ...existingPayment,
          status: 'captured',
          razorpay_payment_id: 'pay_razorpay_001',
          last_four: '4242',
          card_brand: 'Visa',
          risk_rating: 'safe',
        });

        const result = await paymentService.confirmPayment(storeId, dto);

        expect(result.status).toBe('captured');
        expect(result.last_four).toBe('4242');
        expect(result.card_brand).toBe('Visa');
      });

      it('should reject if amount mismatch', async () => {
        const dto: ConfirmPaymentDto = {
          payment_id: 'payment-uuid-001',
          razorpay_payment_id: 'pay_razorpay_001',
        };

        const existingPayment = new PaymentEntity();
        existingPayment.amount = 1000;

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(existingPayment);
        mockRazorpay.getPayment.mockResolvedValue({
          amount: 200000, // Different amount (2000 INR)
          status: 'captured',
        });

        await expect(paymentService.confirmPayment(storeId, dto)).rejects.toThrow(
          'Payment amount mismatch'
        );
      });

      it('should handle failed payment status', async () => {
        const dto: ConfirmPaymentDto = {
          payment_id: 'payment-uuid-001',
          razorpay_payment_id: 'pay_razorpay_001',
        };

        const existingPayment = new PaymentEntity();
        existingPayment.id = 'payment-uuid-001';
        existingPayment.amount = 1000;
        existingPayment.status = 'pending';

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(existingPayment);
        mockRazorpay.getPayment.mockResolvedValue({
          amount: 100000,
          status: 'failed',
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Card declined',
        });

        mockPaymentRepo.save.mockResolvedValue({
          ...existingPayment,
          status: 'failed',
          error_code: 'BAD_REQUEST_ERROR',
          error_message: 'Card declined',
        });

        const result = await paymentService.confirmPayment(storeId, dto);

        expect(result.status).toBe('failed');
        expect(result.error_code).toBe('BAD_REQUEST_ERROR');
      });
    });

    describe('capturePayment', () => {
      it('should capture authorized payment', async () => {
        const payment = new PaymentEntity();
        payment.id = 'payment-uuid-001';
        payment.status = 'authorized';
        payment.razorpay_payment_id = 'pay_razorpay_001';
        payment.amount = 1000;

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);
        mockRazorpay.capturePayment.mockResolvedValue({
          id: 'pay_razorpay_001',
          status: 'captured',
        });

        mockPaymentRepo.save.mockResolvedValue({
          ...payment,
          status: 'captured',
        });

        const result = await paymentService.capturePayment(storeId, {
          payment_id: 'payment-uuid-001',
          amount: 1000,
        });

        expect(result.status).toBe('captured');
      });

      it('should reject if payment not authorized', async () => {
        const payment = new PaymentEntity();
        payment.status = 'pending';

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);

        await expect(
          paymentService.capturePayment(storeId, {
            payment_id: 'payment-uuid-001',
            amount: 1000,
          })
        ).rejects.toThrow('Only authorized payments can be captured');
      });
    });
  });

  describe('Refund Lifecycle', () => {
    describe('validateRefundEligibility', () => {
      it('should validate refund eligibility', async () => {
        const payment = new PaymentEntity();
        payment.status = 'captured';
        payment.amount = 1000;

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);
        mockRefundRepo.getTotalRefunded.mockResolvedValue(0);

        const result = await paymentService.validateRefundEligibility(storeId, 'payment-uuid-001');

        expect(result.eligible).toBe(true);
        expect(result.maxAmount).toBe(1000);
      });

      it('should reject if payment not captured', async () => {
        const payment = new PaymentEntity();
        payment.status = 'pending';

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);

        const result = await paymentService.validateRefundEligibility(storeId, 'payment-uuid-001');

        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('Only captured payments can be refunded');
      });

      it('should calculate remaining refund amount', async () => {
        const payment = new PaymentEntity();
        payment.status = 'captured';
        payment.amount = 1000;

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);
        mockRefundRepo.getTotalRefunded.mockResolvedValue(300); // Already refunded 300

        const result = await paymentService.validateRefundEligibility(storeId, 'payment-uuid-001');

        expect(result.eligible).toBe(true);
        expect(result.maxAmount).toBe(700); // 1000 - 300
      });

      it('should reject if fully refunded', async () => {
        const payment = new PaymentEntity();
        payment.status = 'captured';
        payment.amount = 1000;

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);
        mockRefundRepo.getTotalRefunded.mockResolvedValue(1000); // Already fully refunded

        const result = await paymentService.validateRefundEligibility(storeId, 'payment-uuid-001');

        expect(result.eligible).toBe(false);
        expect(result.reason).toContain('already fully refunded');
      });
    });

    describe('requestRefund', () => {
      it('should create refund request', async () => {
        const payment = new PaymentEntity();
        payment.status = 'captured';
        payment.amount = 1000;

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);
        mockRefundRepo.getTotalRefunded.mockResolvedValue(0);

        mockRefundRepo.save.mockResolvedValue({
          id: 'refund-uuid-001',
          store_id: storeId,
          payment_id: 'payment-uuid-001',
          order_id: orderId,
          amount: 500,
          reason: 'customer_requested',
          status: 'pending_approval',
          metadata: expect.any(Object),
        });

        const result = await paymentService.requestRefund(
          storeId,
          'payment-uuid-001',
          orderId,
          500,
          'customer_requested',
          'User requested refund'
        );

        expect(result.status).toBe('pending_approval');
        expect(result.amount).toBe(500);
      });

      it('should reject if refund exceeds max amount', async () => {
        const payment = new PaymentEntity();
        payment.status = 'captured';
        payment.amount = 1000;

        mockPaymentRepo.findByIdOrFail.mockResolvedValue(payment);
        mockRefundRepo.getTotalRefunded.mockResolvedValue(0);

        await expect(
          paymentService.requestRefund(storeId, 'payment-uuid-001', orderId, 1500)
        ).rejects.toThrow('exceeds maximum');
      });
    });

    describe('approveRefund', () => {
      it('should approve pending refund', async () => {
        const refund = new RefundEntity();
        refund.id = 'refund-uuid-001';
        refund.status = 'pending_approval';

        mockRefundRepo.findByIdOrFail.mockResolvedValue(refund);
        mockRefundRepo.save.mockResolvedValue({
          ...refund,
          status: 'approved',
          approved_by: 'admin-uuid-001',
          approval_date: new Date(),
        });

        const result = await refundService.approveRefund(storeId, {
          refund_id: 'refund-uuid-001',
          approved_by: 'admin-uuid-001',
          approval_notes: 'Approved for return',
        });

        expect(result.status).toBe('approved');
        expect(result.approved_by).toBe('admin-uuid-001');
      });

      it('should reject if refund not pending', async () => {
        const refund = new RefundEntity();
        refund.status = 'rejected';

        mockRefundRepo.findByIdOrFail.mockResolvedValue(refund);

        await expect(
          refundService.approveRefund(storeId, {
            refund_id: 'refund-uuid-001',
            approved_by: 'admin-uuid-001',
          })
        ).rejects.toThrow('Cannot approve refund');
      });
    });

    describe('rejectRefund', () => {
      it('should reject pending refund', async () => {
        const refund = new RefundEntity();
        refund.id = 'refund-uuid-001';
        refund.status = 'pending_approval';

        mockRefundRepo.findByIdOrFail.mockResolvedValue(refund);
        mockRefundRepo.save.mockResolvedValue({
          ...refund,
          status: 'rejected',
        });

        const result = await refundService.rejectRefund(storeId, {
          refund_id: 'refund-uuid-001',
          reason: 'Outside return window',
        });

        expect(result.status).toBe('rejected');
      });
    });
  });

  describe('Webhook Event Processing', () => {
    describe('payment.authorized', () => {
      it('should handle payment.authorized event', async () => {
        const payment = new PaymentEntity();
        payment.id = 'payment-uuid-001';
        payment.status = 'pending';

        mockPaymentRepo.findByRazorpayId.mockResolvedValue(payment);
        mockPaymentRepo.save.mockResolvedValue({
          ...payment,
          status: 'authorized',
          last_four: '4242',
          card_brand: 'Visa',
          risk_rating: 'safe',
        });

        const webhook: RazorpayWebhookDto = {
          event: 'payment.authorized',
          created_at: Date.now() / 1000,
          payload: {
            payment: {
              id: 'pay_razorpay_001',
              card: {
                last4: '4242',
                network: 'Visa',
              },
              risk: {
                signal: 'safe',
              },
            },
          },
        };

        const result = await webhookService.handleWebhook(storeId, webhook);

        expect(result.success).toBe(true);
        expect(result.event).toBe('payment.authorized');
      });
    });

    describe('payment.captured', () => {
      it('should handle payment.captured event', async () => {
        const payment = new PaymentEntity();
        payment.id = 'payment-uuid-001';
        payment.status = 'authorized';
        payment.amount = 1000;

        mockPaymentRepo.findByRazorpayId.mockResolvedValue(payment);
        mockPaymentRepo.save.mockResolvedValue({
          ...payment,
          status: 'captured',
        });

        const webhook: RazorpayWebhookDto = {
          event: 'payment.captured',
          created_at: Date.now() / 1000,
          payload: {
            payment: {
              id: 'pay_razorpay_001',
              amount: 100000,
              status: 'captured',
            },
          },
        };

        const result = await webhookService.handleWebhook(storeId, webhook);

        expect(result.success).toBe(true);
        expect(result.event).toBe('payment.captured');
      });
    });

    describe('payment.failed', () => {
      it('should handle payment.failed event', async () => {
        const payment = new PaymentEntity();
        payment.id = 'payment-uuid-001';
        payment.status = 'pending';

        mockPaymentRepo.findByRazorpayId.mockResolvedValue(payment);
        mockPaymentRepo.save.mockResolvedValue({
          ...payment,
          status: 'failed',
          error_code: 'BAD_REQUEST_ERROR',
        });

        const webhook: RazorpayWebhookDto = {
          event: 'payment.failed',
          created_at: Date.now() / 1000,
          payload: {
            payment: {
              id: 'pay_razorpay_001',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Card declined',
              error_reason: 'insufficient_funds',
            },
          },
        };

        const result = await webhookService.handleWebhook(storeId, webhook);

        expect(result.success).toBe(true);
        expect(result.event).toBe('payment.failed');
      });
    });

    describe('refund.processed', () => {
      it('should handle refund.processed event', async () => {
        const refund = new RefundEntity();
        refund.id = 'refund-uuid-001';
        refund.status = 'approved';

        mockRefundRepo.findByRazorpayRefundId.mockResolvedValue(refund);
        mockRefundRepo.save.mockResolvedValue({
          ...refund,
          status: 'succeeded',
          razorpay_refund_id: 'rfnd_razorpay_001',
        });

        const webhook: RazorpayWebhookDto = {
          event: 'refund.processed',
          created_at: Date.now() / 1000,
          payload: {
            refund: {
              id: 'rfnd_razorpay_001',
              status: 'processed',
            },
          },
        };

        const result = await webhookService.handleWebhook(storeId, webhook);

        expect(result.success).toBe(true);
        expect(result.event).toBe('refund.processed');
      });
    });

    describe('refund.failed', () => {
      it('should handle refund.failed event', async () => {
        const refund = new RefundEntity();
        refund.id = 'refund-uuid-001';
        refund.status = 'approved';

        mockRefundRepo.findByRazorpayRefundId.mockResolvedValue(refund);
        mockRefundRepo.save.mockResolvedValue({
          ...refund,
          status: 'failed',
        });

        const webhook: RazorpayWebhookDto = {
          event: 'refund.failed',
          created_at: Date.now() / 1000,
          payload: {
            refund: {
              id: 'rfnd_razorpay_001',
              reason: 'account_closed',
            },
          },
        };

        const result = await webhookService.handleWebhook(storeId, webhook);

        expect(result.success).toBe(true);
        expect(result.event).toBe('refund.failed');
      });
    });

    describe('Idempotency', () => {
      it('should handle duplicate webhook events safely', async () => {
        const payment = new PaymentEntity();
        payment.id = 'payment-uuid-001';
        payment.status = 'authorized';

        mockPaymentRepo.findByRazorpayId.mockResolvedValue(payment);
        mockPaymentRepo.save.mockResolvedValue({
          ...payment,
          status: 'captured',
        });

        const webhook: RazorpayWebhookDto = {
          event: 'payment.captured',
          created_at: Date.now() / 1000,
          payload: {
            payment: {
              id: 'pay_razorpay_001',
              amount: 100000,
              status: 'captured',
            },
          },
        };

        // First webhook
        const result1 = await webhookService.handleWebhook(storeId, webhook);
        expect(result1.success).toBe(true);

        // Duplicate webhook (retry)
        const result2 = await webhookService.handleWebhook(storeId, webhook);
        expect(result2.success).toBe(true);

        // Both should succeed without errors
        expect(mockPaymentRepo.save).toHaveBeenCalledTimes(2);
      });
    });

    describe('Missing Entities', () => {
      it('should handle missing payment gracefully', async () => {
        mockPaymentRepo.findByRazorpayId.mockResolvedValue(null);

        const webhook: RazorpayWebhookDto = {
          event: 'payment.captured',
          created_at: Date.now() / 1000,
          payload: {
            payment: {
              id: 'pay_unknown',
            },
          },
        };

        const result = await webhookService.handleWebhook(storeId, webhook);

        expect(result.success).toBe(false);
        expect(result.message).toContain('not found');
      });

      it('should handle missing refund gracefully', async () => {
        mockRefundRepo.findByRazorpayRefundId.mockResolvedValue(null);

        const webhook: RazorpayWebhookDto = {
          event: 'refund.processed',
          created_at: Date.now() / 1000,
          payload: {
            refund: {
              id: 'rfnd_unknown',
            },
          },
        };

        const result = await webhookService.handleWebhook(storeId, webhook);

        expect(result.success).toBe(false);
        expect(result.message).toContain('not found');
      });
    });
  });

  describe('Store Isolation', () => {
    it('should not allow cross-store payment access', async () => {
      const otherStoreId = 'store-uuid-002';
      const payment = new PaymentEntity();
      payment.id = 'payment-uuid-001';
      payment.store_id = storeId; // Different store

      mockPaymentRepo.findByIdOrFail.mockImplementation((id, id2) => {
        if (id2 !== storeId) {
          throw new Error(`Payment ${id} not found for store ${id2}`);
        }
        return payment;
      });

      await expect(paymentService.getPayment(otherStoreId, 'payment-uuid-001')).rejects.toThrow(
        'not found'
      );
    });

    it('should not allow cross-store refund access', async () => {
      const otherStoreId = 'store-uuid-002';
      const refund = new RefundEntity();
      refund.id = 'refund-uuid-001';
      refund.store_id = storeId; // Different store

      mockRefundRepo.findByIdOrFail.mockImplementation((id, id2) => {
        if (id2 !== storeId) {
          throw new Error(`Refund ${id} not found for store ${id2}`);
        }
        return refund;
      });

      await expect(refundService.getRefund(otherStoreId, 'refund-uuid-001')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection errors', async () => {
      mockPaymentRepo.findByIdOrFail.mockRejectedValue(
        new Error('Database connection failed')
      );

      const dto: ConfirmPaymentDto = {
        payment_id: 'payment-uuid-001',
        razorpay_payment_id: 'pay_razorpay_001',
      };

      await expect(paymentService.confirmPayment(storeId, dto)).rejects.toThrow();
    });

    it('should handle invalid webhook payload', async () => {
      const webhook: RazorpayWebhookDto = {
        event: 'payment.authorized',
        created_at: Date.now() / 1000,
        payload: {}, // Missing payment data
      };

      const result = await webhookService.handleWebhook(storeId, webhook);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No payment data');
    });

    it('should handle unsupported webhook events', async () => {
      const webhook: RazorpayWebhookDto = {
        event: 'unknown.event',
        created_at: Date.now() / 1000,
        payload: {},
      };

      const result = await webhookService.handleWebhook(storeId, webhook);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported event type');
    });
  });

  describe('Dashboard & Reporting', () => {
    it('should retrieve refund statistics', async () => {
      mockRefundRepo.countByStatus
        .mockResolvedValueOnce(5) // pending_approval
        .mockResolvedValueOnce(3) // approved
        .mockResolvedValueOnce(1) // rejected
        .mockResolvedValueOnce(20) // succeeded
        .mockResolvedValueOnce(2); // failed

      mockRefundRepo.findByStatus.mockResolvedValue([
        { amount: 500 },
        { amount: 300 },
        { amount: 200 },
      ] as any);

      const stats = await refundService.getRefundStatistics(storeId);

      expect(stats.pending_approval).toBe(5);
      expect(stats.approved).toBe(3);
      expect(stats.rejected).toBe(1);
      expect(stats.succeeded).toBe(20);
      expect(stats.failed).toBe(2);
      expect(stats.total_refunded).toBe(1000);
    });

    it('should list pending refunds for admin', async () => {
      const pendingRefunds = [
        {
          id: 'refund-1',
          amount: 500,
          status: 'pending_approval',
        },
        {
          id: 'refund-2',
          amount: 300,
          status: 'pending_approval',
        },
      ];

      mockRefundRepo.findPending.mockResolvedValue(pendingRefunds as any);

      const result = await refundService.getPendingRefunds(storeId, 50);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending_approval');
    });
  });
});
