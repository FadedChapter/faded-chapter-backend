/**
 * Webhook Routes
 * Handles all webhook API endpoints
 *
 * Phase 9: Payment Processing
 */

import { Router, Request, Response } from 'express';
import { WebhookHandlerService } from '../services/webhook-handler.service';
import { RazorpayIntegrationService } from '../services/razorpay-integration.service';
import { WebhookController } from '../controllers/webhook.controller';

/**
 * Create Webhook Routes
 * All routes prefixed with /api/v1/stores/:storeId/webhooks
 */
export function createWebhookRoutes(
  webhookHandler: WebhookHandlerService,
  razorpay: RazorpayIntegrationService
): Router {
  const router = Router({ mergeParams: true });
  const controller = new WebhookController(webhookHandler, razorpay);

  /**
   * Webhook Endpoints
   */

  // POST /webhooks/razorpay
  // Main webhook endpoint (signature validation required)
  router.post('/razorpay', (req: Request, res: Response) => {
    return controller.handleRazorpayWebhook(req, res);
  });

  // POST /webhooks/razorpay/test
  // Test webhook endpoint (no signature validation, development only)
  router.post('/razorpay/test', (req: Request, res: Response) => {
    return controller.testRazorpayWebhook(req, res);
  });

  // GET /webhooks/health
  // Health check
  router.get('/health', (req: Request, res: Response) => {
    return controller.webhookHealth(req, res);
  });

  return router;
}
