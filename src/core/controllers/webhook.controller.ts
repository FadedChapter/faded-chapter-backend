/**
 * Webhook Controller
 * Handles incoming Razorpay webhook requests
 *
 * Phase 9: Payment Processing
 */

import { Request, Response } from 'express';
import { WebhookHandlerService } from '../services/webhook-handler.service';
import { RazorpayIntegrationService } from '../services/razorpay-integration.service';
import { RazorpayWebhookDto } from '../dtos/payment.dto';

/**
 * Webhook Controller
 * Validates and processes Razorpay webhooks
 */
export class WebhookController {
  constructor(
    private webhookHandler: WebhookHandlerService,
    private razorpay: RazorpayIntegrationService
  ) {}

  /**
   * POST /webhooks/razorpay
   * Receive and process Razorpay webhooks
   *
   * Requires:
   * - X-Razorpay-Signature header with HMAC signature
   * - JSON body with event and payload
   */
  async handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const signature = req.headers['x-razorpay-signature'] as string;
      const body = JSON.stringify(req.body);

      // Validate webhook signature
      if (!signature) {
        res.status(400).json({
          success: false,
          error: 'Missing X-Razorpay-Signature header',
        });
        return;
      }

      // Verify signature
      const isValid = this.razorpay.validateWebhookSignature(
        body,
        signature,
        process.env['RAZORPAY_WEBHOOK_SECRET']
      );

      if (!isValid) {
        res.status(401).json({
          success: false,
          error: 'Invalid webhook signature',
        });
        return;
      }

      // Parse webhook payload
      const webhook: RazorpayWebhookDto = req.body;

      // Log webhook receipt
      console.log(`[Webhook] Received ${webhook.event} for store ${storeId}`);

      // Process webhook event synchronously
      const result = await this.webhookHandler.handleWebhook(storeId, webhook);

      // Return success response
      res.status(200).json({
        success: result.success,
        event: result.event,
        message: result.message,
        payment_id: result.payment_id,
        refund_id: result.refund_id,
      });
    } catch (error) {
      console.error('[Webhook Error]', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * POST /webhooks/razorpay/test
   * Test webhook endpoint (for development)
   * Does NOT require signature validation
   */
  async testRazorpayWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const webhook: RazorpayWebhookDto = req.body;

      console.log(`[Webhook Test] Received ${webhook.event} for store ${storeId}`);

      const result = await this.webhookHandler.handleWebhook(storeId, webhook);

      res.status(200).json({
        success: result.success,
        event: result.event,
        message: result.message,
      });
    } catch (error) {
      console.error('[Webhook Test Error]', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /webhooks/health
   * Health check endpoint for webhook service
   */
  async webhookHealth(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      service: 'webhook-handler',
      status: 'operational',
      timestamp: new Date().toISOString(),
    });
  }
}
