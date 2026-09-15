/**
 * Payment Controller
 * Handles payment-related HTTP requests
 *
 * Phase 9: Payment Processing
 */

import { Request, Response, Router } from 'express';
import { PaymentProcessingService } from '../services/payment-processing.service';
import { RefundService } from '../services/refund.service';
import {
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  CapturePaymentDto,
  CreateRefundDto,
  ApproveRefundDto,
  RejectRefundDto,
} from '../dtos/payment.dto';

/**
 * Payment Controller
 * Handles payment and refund endpoints
 */
export class PaymentController {
  constructor(
    private paymentService: PaymentProcessingService,
    private refundService: RefundService
  ) {}

  /**
   * POST /payments/intents
   * Create a payment intent (initialize payment process)
   */
  async createPaymentIntent(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const dto: CreatePaymentIntentDto = req.body;

      const payment = await this.paymentService.createPaymentIntent(storeId, dto);

      res.status(201).json({
        success: true,
        payment: {
          id: payment.id,
          razorpay_order_id: payment.razorpay_order_id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /payments/confirm
   * Confirm payment after customer completes Razorpay checkout
   */
  async confirmPayment(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const dto: ConfirmPaymentDto = req.body;

      const payment = await this.paymentService.confirmPayment(storeId, dto);

      res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          razorpay_payment_id: payment.razorpay_payment_id,
          amount: payment.amount,
          error_code: payment.error_code,
          error_message: payment.error_message,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /payments/:paymentId/capture
   * Capture an authorized payment
   */
  async capturePayment(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, paymentId } = req.params;
      const { amount } = req.body;

      const dto: CapturePaymentDto = {
        payment_id: paymentId,
        amount,
      };

      const payment = await this.paymentService.capturePayment(storeId, dto);

      res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /payments/:paymentId
   * Retrieve payment details
   */
  async getPayment(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, paymentId } = req.params;

      const payment = await this.paymentService.getPayment(storeId, paymentId);

      res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          order_id: payment.order_id,
          customer_id: payment.customer_id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          payment_method: payment.payment_method,
          payment_method_type: payment.payment_method_type,
          last_four: payment.last_four,
          card_brand: payment.card_brand,
          risk_rating: payment.risk_rating,
          created_at: payment.created_at,
        },
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /payments
   * List customer's payments (with pagination)
   */
  async listPayments(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { customer_id, limit = '50', offset = '0' } = req.query;

      if (!customer_id) {
        res.status(400).json({
          success: false,
          error: 'customer_id query parameter is required',
        });
        return;
      }

      const result = await this.paymentService.listPayments(
        storeId,
        customer_id as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        payments: result.payments.map((p) => ({
          id: p.id,
          order_id: p.order_id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          created_at: p.created_at,
        })),
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /payments/:paymentId/refunds
   * Request a refund for a payment (creates pending refund request)
   */
  async requestRefund(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, paymentId } = req.params;
      const { order_id, amount, reason, notes } = req.body;

      if (!order_id) {
        res.status(400).json({
          success: false,
          error: 'order_id is required',
        });
        return;
      }

      const refund = await this.paymentService.requestRefund(
        storeId,
        paymentId,
        order_id,
        amount,
        reason,
        notes
      );

      res.status(201).json({
        success: true,
        refund: this.refundService.toResponseDto(refund),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /payments/:paymentId/refund-eligibility
   * Check if a payment can be refunded and max refund amount
   */
  async getRefundEligibility(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, paymentId } = req.params;

      const eligibility = await this.paymentService.validateRefundEligibility(
        storeId,
        paymentId
      );

      res.status(200).json({
        success: true,
        eligible: eligibility.eligible,
        maxAmount: eligibility.maxAmount,
        reason: eligibility.reason,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /refunds/:refundId
   * Get refund details
   */
  async getRefund(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, refundId } = req.params;

      const refund = await this.refundService.getRefund(storeId, refundId);

      res.status(200).json({
        success: true,
        refund: this.refundService.toResponseDto(refund),
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /payments/:paymentId/refunds
   * List refunds for a payment
   */
  async listRefundsForPayment(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, paymentId } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      const result = await this.refundService.listRefundsForPayment(
        storeId,
        paymentId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        refunds: result.refunds.map((r) => this.refundService.toResponseDto(r)),
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /refunds?status=pending_approval
   * List refunds by status (admin endpoint)
   */
  async listRefundsByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { status = 'pending_approval', limit = '50', offset = '0' } = req.query;

      if (!status) {
        res.status(400).json({
          success: false,
          error: 'status query parameter is required',
        });
        return;
      }

      const result = await this.refundService.listRefundsByStatus(
        storeId,
        status as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        refunds: result.refunds.map((r) => this.refundService.toResponseDto(r)),
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /refunds/:refundId/approve
   * Approve a pending refund request (admin)
   */
  async approveRefund(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, refundId } = req.params;
      const { approved_by, approval_notes } = req.body;

      if (!approved_by) {
        res.status(400).json({
          success: false,
          error: 'approved_by is required',
        });
        return;
      }

      const dto: ApproveRefundDto = {
        refund_id: refundId,
        approved_by,
        approval_notes,
      };

      const refund = await this.refundService.approveRefund(storeId, dto);

      res.status(200).json({
        success: true,
        refund: this.refundService.toResponseDto(refund),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /refunds/:refundId/reject
   * Reject a pending refund request (admin)
   */
  async rejectRefund(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, refundId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'reason is required',
        });
        return;
      }

      const dto: RejectRefundDto = {
        refund_id: refundId,
        reason,
      };

      const refund = await this.refundService.rejectRefund(storeId, dto);

      res.status(200).json({
        success: true,
        refund: this.refundService.toResponseDto(refund),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /refunds/dashboard/pending
   * Get pending refunds for admin dashboard
   */
  async getPendingRefunds(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { limit = '50' } = req.query;

      const refunds = await this.refundService.getPendingRefunds(
        storeId,
        parseInt(limit as string)
      );

      res.status(200).json({
        success: true,
        refunds: refunds.map((r) => this.refundService.toResponseDto(r)),
        total: refunds.length,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /refunds/dashboard/statistics
   * Get refund statistics for dashboard
   */
  async getRefundStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;

      const stats = await this.refundService.getRefundStatistics(storeId);

      res.status(200).json({
        success: true,
        statistics: stats,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}
