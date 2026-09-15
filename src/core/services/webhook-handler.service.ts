/**
 * Webhook Handler Service
 * Processes Razorpay webhook events synchronously
 *
 * Phase 9: Payment Processing
 */

import { PaymentEntity } from '../entities/payment.entity';
import { RefundEntity } from '../entities/refund.entity';
import { PaymentRepository, RefundRepository } from '../repositories/payment.repositories';
import { RazorpayIntegrationService } from './razorpay-integration.service';
import { RazorpayWebhookDto } from '../dtos/payment.dto';

/**
 * Webhook Event Handler
 * Processes Razorpay webhook events synchronously
 *
 * Supported events:
 * - payment.authorized
 * - payment.failed
 * - payment.captured
 * - refund.created
 * - refund.processed
 * - refund.failed
 * - dispute.created
 */
export class WebhookHandlerService {
  constructor(
    private paymentRepo: PaymentRepository,
    private refundRepo: RefundRepository,
    private razorpay: RazorpayIntegrationService
  ) {}

  /**
   * Process Webhook Event
   * Main entry point for webhook handling
   */
  async handleWebhook(storeId: string, event: RazorpayWebhookDto): Promise<{
    success: boolean;
    event: string;
    message: string;
    payment_id?: string;
    refund_id?: string;
  }> {
    try {
      switch (event.event) {
        // Payment Events
        case 'payment.authorized':
          return this.handlePaymentAuthorized(storeId, event);

        case 'payment.failed':
          return this.handlePaymentFailed(storeId, event);

        case 'payment.captured':
          return this.handlePaymentCaptured(storeId, event);

        // Refund Events
        case 'refund.created':
          return this.handleRefundCreated(storeId, event);

        case 'refund.processed':
          return this.handleRefundProcessed(storeId, event);

        case 'refund.failed':
          return this.handleRefundFailed(storeId, event);

        // Dispute Events (log but don't process yet)
        case 'dispute.created':
          return this.handleDisputeCreated(storeId, event);

        default:
          return {
            success: false,
            event: event.event,
            message: `Unsupported event type: ${event.event}`,
          };
      }
    } catch (error) {
      throw new Error(`Webhook processing failed for ${event.event}: ${(error as Error).message}`);
    }
  }

  /**
   * Handle payment.authorized event
   */
  private async handlePaymentAuthorized(
    storeId: string,
    event: RazorpayWebhookDto
  ): Promise<{
    success: boolean;
    event: string;
    message: string;
    payment_id?: string;
  }> {
    if (!event.payload?.payment) {
      return {
        success: false,
        event: 'payment.authorized',
        message: 'No payment data in webhook',
      };
    }

    const razorpayPaymentId = event.payload.payment.id;

    try {
      // Find payment by Razorpay ID
      const payment = await this.paymentRepo.findByRazorpayId(razorpayPaymentId, storeId);

      if (!payment) {
        return {
          success: false,
          event: 'payment.authorized',
          message: `Payment ${razorpayPaymentId} not found`,
          payment_id: razorpayPaymentId,
        };
      }

      // Update payment status
      payment.status = 'authorized';
      payment.razorpay_payment_id = razorpayPaymentId;
      payment.last_four = event.payload.payment.card?.last4;
      payment.card_brand = event.payload.payment.card?.network;
      payment.risk_rating = event.payload.payment.risk?.signal;
      payment.risk_reason = event.payload.payment.risk?.reason;
      payment.metadata = {
        ...(payment.metadata || {}),
        webhook_authorized_at: new Date().toISOString(),
      };

      await this.paymentRepo.save(payment);

      return {
        success: true,
        event: 'payment.authorized',
        message: 'Payment authorized successfully',
        payment_id: payment.id,
      };
    } catch (error) {
      return {
        success: false,
        event: 'payment.authorized',
        message: `Error processing payment authorization: ${(error as Error).message}`,
        payment_id: razorpayPaymentId,
      };
    }
  }

  /**
   * Handle payment.failed event
   */
  private async handlePaymentFailed(
    storeId: string,
    event: RazorpayWebhookDto
  ): Promise<{
    success: boolean;
    event: string;
    message: string;
    payment_id?: string;
  }> {
    if (!event.payload?.payment) {
      return {
        success: false,
        event: 'payment.failed',
        message: 'No payment data in webhook',
      };
    }

    const razorpayPaymentId = event.payload.payment.id;

    try {
      const payment = await this.paymentRepo.findByRazorpayId(razorpayPaymentId, storeId);

      if (!payment) {
        return {
          success: false,
          event: 'payment.failed',
          message: `Payment ${razorpayPaymentId} not found`,
          payment_id: razorpayPaymentId,
        };
      }

      // Update payment status
      payment.status = 'failed';
      payment.error_code = event.payload.payment.error_code;
      payment.error_message = event.payload.payment.error_description;
      payment.metadata = {
        ...(payment.metadata || {}),
        webhook_failed_at: new Date().toISOString(),
        failure_reason: event.payload.payment.error_reason,
      };

      await this.paymentRepo.save(payment);

      return {
        success: true,
        event: 'payment.failed',
        message: 'Payment failure recorded',
        payment_id: payment.id,
      };
    } catch (error) {
      return {
        success: false,
        event: 'payment.failed',
        message: `Error processing payment failure: ${(error as Error).message}`,
        payment_id: razorpayPaymentId,
      };
    }
  }

  /**
   * Handle payment.captured event
   */
  private async handlePaymentCaptured(
    storeId: string,
    event: RazorpayWebhookDto
  ): Promise<{
    success: boolean;
    event: string;
    message: string;
    payment_id?: string;
  }> {
    if (!event.payload?.payment) {
      return {
        success: false,
        event: 'payment.captured',
        message: 'No payment data in webhook',
      };
    }

    const razorpayPaymentId = event.payload.payment.id;

    try {
      const payment = await this.paymentRepo.findByRazorpayId(razorpayPaymentId, storeId);

      if (!payment) {
        return {
          success: false,
          event: 'payment.captured',
          message: `Payment ${razorpayPaymentId} not found`,
          payment_id: razorpayPaymentId,
        };
      }

      // Update payment status
      payment.status = 'captured';
      payment.razorpay_payment_id = razorpayPaymentId;
      payment.amount = (event.payload.payment.amount as number) / 100 || payment.amount; // Convert from paise
      payment.metadata = {
        ...(payment.metadata || {}),
        webhook_captured_at: new Date().toISOString(),
        fee: event.payload.payment.fee,
      };

      await this.paymentRepo.save(payment);

      return {
        success: true,
        event: 'payment.captured',
        message: 'Payment captured successfully',
        payment_id: payment.id,
      };
    } catch (error) {
      return {
        success: false,
        event: 'payment.captured',
        message: `Error processing payment capture: ${(error as Error).message}`,
        payment_id: razorpayPaymentId,
      };
    }
  }

  /**
   * Handle refund.created event
   */
  private async handleRefundCreated(
    storeId: string,
    event: RazorpayWebhookDto
  ): Promise<{
    success: boolean;
    event: string;
    message: string;
    refund_id?: string;
  }> {
    if (!event.payload?.refund) {
      return {
        success: false,
        event: 'refund.created',
        message: 'No refund data in webhook',
      };
    }

    const razorpayRefundId = event.payload.refund.id;

    try {
      // Find refund by Razorpay ID
      const refund = await this.refundRepo.findByRazorpayRefundId(razorpayRefundId, storeId);

      if (!refund) {
        // Refund might be from another system, log and ignore
        return {
          success: true,
          event: 'refund.created',
          message: `Refund ${razorpayRefundId} not found in local system (external refund)`,
          refund_id: razorpayRefundId,
        };
      }

      // Update refund status
      refund.razorpay_refund_id = razorpayRefundId;
      refund.metadata = {
        ...(refund.metadata || {}),
        webhook_created_at: new Date().toISOString(),
      };

      await this.refundRepo.save(refund);

      return {
        success: true,
        event: 'refund.created',
        message: 'Refund creation acknowledged',
        refund_id: refund.id,
      };
    } catch (error) {
      return {
        success: false,
        event: 'refund.created',
        message: `Error processing refund creation: ${(error as Error).message}`,
        refund_id: razorpayRefundId,
      };
    }
  }

  /**
   * Handle refund.processed event
   */
  private async handleRefundProcessed(
    storeId: string,
    event: RazorpayWebhookDto
  ): Promise<{
    success: boolean;
    event: string;
    message: string;
    refund_id?: string;
  }> {
    if (!event.payload?.refund) {
      return {
        success: false,
        event: 'refund.processed',
        message: 'No refund data in webhook',
      };
    }

    const razorpayRefundId = event.payload.refund.id;

    try {
      const refund = await this.refundRepo.findByRazorpayRefundId(razorpayRefundId, storeId);

      if (!refund) {
        return {
          success: false,
          event: 'refund.processed',
          message: `Refund ${razorpayRefundId} not found`,
          refund_id: razorpayRefundId,
        };
      }

      // Update refund status to succeeded
      refund.status = 'succeeded';
      refund.razorpay_refund_id = razorpayRefundId;
      refund.metadata = {
        ...(refund.metadata || {}),
        webhook_processed_at: new Date().toISOString(),
      };

      await this.refundRepo.save(refund);

      return {
        success: true,
        event: 'refund.processed',
        message: 'Refund processed successfully',
        refund_id: refund.id,
      };
    } catch (error) {
      return {
        success: false,
        event: 'refund.processed',
        message: `Error processing refund: ${(error as Error).message}`,
        refund_id: razorpayRefundId,
      };
    }
  }

  /**
   * Handle refund.failed event
   */
  private async handleRefundFailed(
    storeId: string,
    event: RazorpayWebhookDto
  ): Promise<{
    success: boolean;
    event: string;
    message: string;
    refund_id?: string;
  }> {
    if (!event.payload?.refund) {
      return {
        success: false,
        event: 'refund.failed',
        message: 'No refund data in webhook',
      };
    }

    const razorpayRefundId = event.payload.refund.id;

    try {
      const refund = await this.refundRepo.findByRazorpayRefundId(razorpayRefundId, storeId);

      if (!refund) {
        return {
          success: false,
          event: 'refund.failed',
          message: `Refund ${razorpayRefundId} not found`,
          refund_id: razorpayRefundId,
        };
      }

      // Update refund status to failed
      refund.status = 'failed';
      refund.metadata = {
        ...(refund.metadata || {}),
        webhook_failed_at: new Date().toISOString(),
        failure_reason: event.payload.refund.reason,
      };

      await this.refundRepo.save(refund);

      return {
        success: true,
        event: 'refund.failed',
        message: 'Refund failure recorded',
        refund_id: refund.id,
      };
    } catch (error) {
      return {
        success: false,
        event: 'refund.failed',
        message: `Error processing refund failure: ${(error as Error).message}`,
        refund_id: razorpayRefundId,
      };
    }
  }

  /**
   * Handle dispute.created event
   * Currently logs only, doesn't update database
   */
  private async handleDisputeCreated(
    storeId: string,
    event: RazorpayWebhookDto
  ): Promise<{
    success: boolean;
    event: string;
    message: string;
  }> {
    // Dispute handling not implemented yet
    // Could create DisputeEntity and track chargebacks
    return {
      success: true,
      event: 'dispute.created',
      message: 'Dispute event received (tracking not yet implemented)',
    };
  }

  /**
   * Find Refund by Razorpay Refund ID
   * Helper method added to RefundRepository
   */
  async findRefundByRazorpayId(razorpayRefundId: string, storeId: string): Promise<RefundEntity | null> {
    return this.refundRepo.findByRazorpayRefundId(razorpayRefundId, storeId);
  }
}
