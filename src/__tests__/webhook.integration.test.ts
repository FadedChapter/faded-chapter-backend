/**
 * Webhook Integration Tests
 * Tests for webhook signature validation and event handling
 *
 * Phase 9: Payment Processing - Phase 9e Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookController } from '../core/controllers/webhook.controller.js';
import { WebhookHandlerService } from '../core/services/webhook-handler.service.js';
import { RazorpayIntegrationService } from '../core/services/razorpay-integration.service.js';
import { RazorpayWebhookDto } from '../core/dtos/payment.dto.js';

// Mock services
const mockWebhookHandler = {
  handleWebhook: vi.fn(),
} as any;

const mockRazorpay = {
  validateWebhookSignature: vi.fn(),
} as any;

// Mock request and response
const createMockRequest = (overrides = {}) => ({
  params: { storeId: 'store-uuid-001' },
  headers: {},
  body: {},
  ...overrides,
});

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as any;
};

describe('Webhook Integration Tests', () => {
  let controller: WebhookController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new WebhookController(mockWebhookHandler, mockRazorpay);
  });

  describe('handleRazorpayWebhook', () => {
    it('should process valid webhook with correct signature', async () => {
      const req = createMockRequest({
        headers: {
          'x-razorpay-signature': 'valid-signature-hash',
        },
        body: {
          event: 'payment.captured',
          payload: {
            payment: {
              id: 'pay_xyz',
              status: 'captured',
            },
          },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.captured',
        message: 'Payment captured successfully',
        payment_id: 'payment-uuid-001',
      });

      await controller.handleRazorpayWebhook(req, res);

      expect(mockRazorpay.validateWebhookSignature).toHaveBeenCalled();
      expect(mockWebhookHandler.handleWebhook).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          event: 'payment.captured',
        })
      );
    });

    it('should reject webhook with missing signature header', async () => {
      const req = createMockRequest({
        headers: {}, // No signature header
        body: {
          event: 'payment.captured',
          payload: { payment: { id: 'pay_xyz' } },
        },
      });

      const res = createMockResponse();

      await controller.handleRazorpayWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Missing'),
        })
      );
      expect(mockWebhookHandler.handleWebhook).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const req = createMockRequest({
        headers: {
          'x-razorpay-signature': 'invalid-signature',
        },
        body: {
          event: 'payment.captured',
          payload: { payment: { id: 'pay_xyz' } },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(false);

      await controller.handleRazorpayWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid'),
        })
      );
      expect(mockWebhookHandler.handleWebhook).not.toHaveBeenCalled();
    });

    it('should handle webhook processing errors', async () => {
      const req = createMockRequest({
        headers: {
          'x-razorpay-signature': 'valid-signature-hash',
        },
        body: {
          event: 'payment.captured',
          payload: { payment: { id: 'pay_xyz' } },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockRejectedValue(
        new Error('Database error')
      );

      await controller.handleRazorpayWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Database error'),
        })
      );
    });
  });

  describe('testRazorpayWebhook', () => {
    it('should process test webhook without signature validation', async () => {
      const req = createMockRequest({
        body: {
          event: 'payment.captured',
          payload: {
            payment: {
              id: 'pay_xyz',
              status: 'captured',
            },
          },
        },
      });

      const res = createMockResponse();

      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.captured',
        message: 'Payment captured successfully',
      });

      await controller.testRazorpayWebhook(req, res);

      expect(mockRazorpay.validateWebhookSignature).not.toHaveBeenCalled();
      expect(mockWebhookHandler.handleWebhook).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle test webhook errors', async () => {
      const req = createMockRequest({
        body: {
          event: 'invalid-event',
          payload: {},
        },
      });

      const res = createMockResponse();

      mockWebhookHandler.handleWebhook.mockRejectedValue(
        new Error('Processing failed')
      );

      await controller.testRazorpayWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('webhookHealth', () => {
    it('should return health status', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.webhookHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          service: 'webhook-handler',
          status: 'operational',
        })
      );
    });
  });

  describe('Webhook Event Scenarios', () => {
    it('should handle payment.authorized event', async () => {
      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'valid' },
        body: {
          event: 'payment.authorized',
          payload: {
            payment: {
              id: 'pay_L8qt5iCGJ1yjw0',
              order_id: 'order_xyz',
              amount: 50000,
              status: 'authorized',
              card: { last4: '4242', network: 'Visa' },
              risk: { signal: 'safe' },
            },
          },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.authorized',
        message: 'Payment authorized successfully',
        payment_id: 'payment-uuid',
      });

      await controller.handleRazorpayWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          event: 'payment.authorized',
        })
      );
    });

    it('should handle payment.failed event', async () => {
      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'valid' },
        body: {
          event: 'payment.failed',
          payload: {
            payment: {
              id: 'pay_L8qt5iCGJ1yjw0',
              status: 'failed',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Card declined',
            },
          },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.failed',
        message: 'Payment failure recorded',
        payment_id: 'payment-uuid',
      });

      await controller.handleRazorpayWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          event: 'payment.failed',
        })
      );
    });

    it('should handle refund.processed event', async () => {
      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'valid' },
        body: {
          event: 'refund.processed',
          payload: {
            refund: {
              id: 'rfnd_L8qt5iCGJ1yjw0',
              payment_id: 'pay_xyz',
              amount: 50000,
              status: 'processed',
            },
          },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'refund.processed',
        message: 'Refund processed successfully',
        refund_id: 'refund-uuid',
      });

      await controller.handleRazorpayWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          event: 'refund.processed',
        })
      );
    });
  });

  describe('Signature Validation', () => {
    it('should validate signature with correct secret', async () => {
      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { id: 'pay_xyz' } },
      });

      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'signature-hash' },
        body: JSON.parse(body),
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockImplementation(
        (bodyStr, sig, secret) => {
          return sig === 'signature-hash' && secret === process.env['RAZORPAY_WEBHOOK_SECRET'];
        }
      );

      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.captured',
        message: 'OK',
      });

      await controller.handleRazorpayWebhook(req, res);

      expect(mockRazorpay.validateWebhookSignature).toHaveBeenCalledWith(
        expect.any(String),
        'signature-hash',
        process.env['RAZORPAY_WEBHOOK_SECRET']
      );
    });

    it('should reject tampered webhook body', async () => {
      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'signature-hash' },
        body: {
          event: 'payment.captured',
          payload: { payment: { id: 'pay_xyz' } },
        },
      });

      const res = createMockResponse();

      // Signature doesn't match tampered body
      mockRazorpay.validateWebhookSignature.mockReturnValue(false);

      await controller.handleRazorpayWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Store Isolation in Webhooks', () => {
    it('should process webhook for correct store', async () => {
      const storeId = 'store-uuid-001';
      const req = createMockRequest({
        params: { storeId },
        headers: { 'x-razorpay-signature': 'valid' },
        body: {
          event: 'payment.captured',
          payload: { payment: { id: 'pay_xyz' } },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.captured',
        message: 'OK',
        payment_id: 'payment-uuid',
      });

      await controller.handleRazorpayWebhook(req, res);

      // Verify handleWebhook was called with correct storeId
      expect(mockWebhookHandler.handleWebhook).toHaveBeenCalledWith(
        storeId,
        expect.any(Object)
      );
    });

    it('should use different store context for different webhooks', async () => {
      const req1 = createMockRequest({
        params: { storeId: 'store-1' },
        headers: { 'x-razorpay-signature': 'valid' },
        body: { event: 'payment.captured', payload: { payment: { id: 'pay_1' } } },
      });

      const req2 = createMockRequest({
        params: { storeId: 'store-2' },
        headers: { 'x-razorpay-signature': 'valid' },
        body: { event: 'payment.captured', payload: { payment: { id: 'pay_2' } } },
      });

      const res1 = createMockResponse();
      const res2 = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.captured',
        message: 'OK',
      });

      await controller.handleRazorpayWebhook(req1, res1);
      await controller.handleRazorpayWebhook(req2, res2);

      // Verify different stores were used
      expect(mockWebhookHandler.handleWebhook).toHaveBeenNthCalledWith(
        1,
        'store-1',
        expect.any(Object)
      );
      expect(mockWebhookHandler.handleWebhook).toHaveBeenNthCalledWith(
        2,
        'store-2',
        expect.any(Object)
      );
    });
  });

  describe('Webhook Retry Handling', () => {
    it('should handle duplicate webhooks idempotently', async () => {
      const webhook = {
        event: 'payment.captured',
        payload: { payment: { id: 'pay_xyz' } },
      };

      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'valid' },
        body: webhook,
      });

      const res1 = createMockResponse();
      const res2 = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.captured',
        message: 'OK',
        payment_id: 'payment-uuid',
      });

      // First webhook
      await controller.handleRazorpayWebhook(req, res1);
      expect(res1.status).toHaveBeenCalledWith(200);

      // Duplicate webhook (retry)
      await controller.handleRazorpayWebhook(req, res2);
      expect(res2.status).toHaveBeenCalledWith(200);

      // Both should succeed
      expect(mockWebhookHandler.handleWebhook).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for missing signature', async () => {
      const req = createMockRequest({
        body: { event: 'payment.captured', payload: {} },
      });

      const res = createMockResponse();

      await controller.handleRazorpayWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
    });

    it('should return consistent error format for invalid signature', async () => {
      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'invalid' },
        body: { event: 'payment.captured', payload: {} },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(false);

      await controller.handleRazorpayWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
    });

    it('should include payment_id in success response', async () => {
      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'valid' },
        body: {
          event: 'payment.captured',
          payload: { payment: { id: 'pay_xyz' } },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'payment.captured',
        message: 'OK',
        payment_id: 'payment-uuid-123',
      });

      await controller.handleRazorpayWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_id: 'payment-uuid-123',
        })
      );
    });

    it('should include refund_id in refund event response', async () => {
      const req = createMockRequest({
        headers: { 'x-razorpay-signature': 'valid' },
        body: {
          event: 'refund.processed',
          payload: { refund: { id: 'rfnd_xyz' } },
        },
      });

      const res = createMockResponse();

      mockRazorpay.validateWebhookSignature.mockReturnValue(true);
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        event: 'refund.processed',
        message: 'OK',
        refund_id: 'refund-uuid-123',
      });

      await controller.handleRazorpayWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          refund_id: 'refund-uuid-123',
        })
      );
    });
  });
});
