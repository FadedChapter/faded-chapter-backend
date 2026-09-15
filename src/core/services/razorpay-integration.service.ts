/**
 * Razorpay Integration Service
 * Handles all Razorpay API interactions
 *
 * Phase 9: Payment Processing
 */

import Razorpay from 'razorpay';
import { RazorpayOrderDto, RazorpayPaymentDto, RazorpayRefundDto } from '../dtos/payment.dto';

/**
 * Razorpay Integration Service
 * Manages Razorpay API calls for orders, payments, and refunds
 */
export class RazorpayIntegrationService {
  private razorpay: Razorpay;

  constructor() {
    const keyId = process.env['RAZORPAY_KEY_ID'];
    const keySecret = process.env['RAZORPAY_KEY_SECRET'];

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  /**
   * Create a Razorpay Order
   * Used before customer selects payment method
   */
  async createOrder(
    amount: number,
    currency: string = 'INR',
    receipt?: string,
    metadata?: Record<string, any>
  ): Promise<RazorpayOrderDto> {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt,
        notes: metadata,
      });

      return {
        id: order.id as string,
        amount: (order.amount as number) || 0,
        currency: order.currency as string,
        receipt: order.receipt,
        status: order.status as string,
        created_at: (order.created_at as number) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to create Razorpay order: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch Payment Details from Razorpay
   * Used to verify payment status after checkout
   */
  async getPayment(paymentId: string): Promise<RazorpayPaymentDto> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);

      return {
        id: payment.id as string,
        order_id: payment.order_id as string,
        amount: (payment.amount as number) || 0,
        currency: payment.currency as string,
        status: payment.status as string,
        method: payment.method as string,
        card: payment.card
          ? {
              id: payment.card.id,
              entity: payment.card.entity,
              name: payment.card.name,
              last4: payment.card.last4,
              network: payment.card.network,
              type: payment.card.type,
              issuer: payment.card.issuer,
              international: payment.card.international,
              emi: payment.card.emi,
              sub_type: payment.card.sub_type,
            }
          : undefined,
        vpa: payment.vpa as string | undefined,
        email: payment.email as string,
        contact: payment.contact as string,
        description: payment.description,
        fee: payment.fee,
        tax: payment.tax,
        error_code: payment.error_code as string | undefined,
        error_description: payment.error_description as string | undefined,
        error_source: payment.error_source as string | undefined,
        error_reason: payment.error_reason as string | undefined,
        error_step: payment.error_step as string | undefined,
        error_field: (payment as any).error_field,
        acquirer_data: payment.acquirer_data,
        risk: (payment as any).risk
          ? {
              signal: (payment as any).risk.signal,
              reason: (payment as any).risk.reason,
            }
          : undefined,
        created_at: (payment.created_at as number) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to fetch Razorpay payment: ${(error as Error).message}`);
    }
  }

  /**
   * Capture Payment
   * Authorizes and captures payment (for authorized payments)
   */
  async capturePayment(paymentId: string, amount: number): Promise<RazorpayPaymentDto> {
    try {
      const payment = await (this.razorpay.payments as any).capture(paymentId, Math.round(amount * 100));

      return {
        id: payment.id as string,
        order_id: payment.order_id as string,
        amount: (payment.amount as number) || 0,
        currency: payment.currency as string,
        status: payment.status as string,
        method: payment.method as string,
        email: payment.email as string,
        contact: payment.contact as string,
        created_at: (payment.created_at as number) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to capture Razorpay payment: ${(error as Error).message}`);
    }
  }

  /**
   * Create a Refund
   * Full or partial refund of a captured payment
   */
  async createRefund(
    paymentId: string,
    amount?: number,
    notes?: Record<string, any>
  ): Promise<RazorpayRefundDto> {
    try {
      const refundData: Record<string, any> = {
        notes,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to paise
      }

      const refund = await (this.razorpay.payments as any).refund(paymentId, refundData);

      return {
        id: refund.id as string,
        entity: refund.entity as string,
        payment_id: refund.payment_id as string,
        amount: (refund.amount as number) || 0,
        currency: refund.currency as string,
        status: refund.status as string,
        speed_processed: refund.speed_processed as string | undefined,
        speed_requested: refund.speed_requested as string | undefined,
        receipt: refund.receipt as string | undefined,
        reason: (refund as any).reason,
        notes: refund.notes,
        created_at: (refund.created_at as number) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to create Razorpay refund: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch Refund Details
   * Get status of a previously created refund
   */
  async getRefund(refundId: string): Promise<RazorpayRefundDto> {
    try {
      const refund = await (this.razorpay.refunds as any).fetch(refundId);

      return {
        id: refund.id as string,
        entity: refund.entity as string,
        payment_id: refund.payment_id as string,
        amount: (refund.amount as number) || 0,
        currency: refund.currency as string,
        status: refund.status as string,
        speed_processed: refund.speed_processed as string | undefined,
        speed_requested: refund.speed_requested as string | undefined,
        receipt: refund.receipt as string | undefined,
        reason: (refund as any).reason,
        notes: refund.notes,
        created_at: (refund.created_at as number) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to fetch Razorpay refund: ${(error as Error).message}`);
    }
  }

  /**
   * Validate Webhook Signature
   * Verifies that webhook came from Razorpay
   */
  validateWebhookSignature(
    body: string,
    signature: string,
    secret: string = process.env['RAZORPAY_WEBHOOK_SECRET'] || ''
  ): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return expectedSignature === signature;
    } catch (error) {
      console.error('Failed to validate webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle Payment Webhook
   * Parse and process webhook event from Razorpay
   */
  parseWebhook(payload: Record<string, any>): {
    event: string;
    payment?: RazorpayPaymentDto;
    refund?: RazorpayRefundDto;
    dispute?: Record<string, any>;
  } {
    const { event, payload: webhookPayload } = payload;

    let result: {
      event: string;
      payment?: RazorpayPaymentDto;
      refund?: RazorpayRefundDto;
      dispute?: Record<string, any>;
    } = {
      event,
    };

    if (webhookPayload.payment) {
      result.payment = {
        id: webhookPayload.payment.id,
        order_id: webhookPayload.payment.order_id,
        amount: webhookPayload.payment.amount,
        currency: webhookPayload.payment.currency,
        status: webhookPayload.payment.status,
        method: webhookPayload.payment.method,
        email: webhookPayload.payment.email,
        contact: webhookPayload.payment.contact,
        error_code: webhookPayload.payment.error_code,
        error_description: webhookPayload.payment.error_description,
        risk: webhookPayload.payment.risk,
        created_at: webhookPayload.payment.created_at,
      };
    }

    if (webhookPayload.refund) {
      result.refund = {
        id: webhookPayload.refund.id,
        entity: webhookPayload.refund.entity,
        payment_id: webhookPayload.refund.payment_id,
        amount: webhookPayload.refund.amount,
        currency: webhookPayload.refund.currency,
        status: webhookPayload.refund.status,
        notes: webhookPayload.refund.notes,
        created_at: webhookPayload.refund.created_at,
      };
    }

    if (webhookPayload.dispute) {
      result.dispute = webhookPayload.dispute;
    }

    return result;
  }

  /**
   * Get Razorpay Account Details
   * Verify credentials are working
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Try to fetch account details
      await (this.razorpay as any).accounts.fetch();
      return true;
    } catch (error) {
      console.error('Failed to validate Razorpay credentials:', error);
      return false;
    }
  }
}
