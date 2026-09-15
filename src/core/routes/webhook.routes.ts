/**
 * Webhook Routes
 * Handles all webhook API endpoints
 *
 * Phase 9: Payment Processing
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireStaff } from '../middleware/require-staff.middleware';
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
  //
  // SECURITY: this calls the same handler as the signed endpoint above but
  // skips signature validation, so a forged payment.captured event would be
  // processed as genuine — marking payments captured and orders paid.
  // "Development only" was a comment, not an enforcement.
  //
  // Now enforced two ways: refused outright when NODE_ENV is production, and
  // staff-only otherwise. The real endpoint is unaffected — it authenticates by
  // HMAC signature, which is the correct mechanism for a machine caller and the
  // reason this router does not sit behind the admin boundary.
  router.post(
    '/razorpay/test',
    (req: Request, res: Response, next: NextFunction) => {
      if (process.env['NODE_ENV'] === 'production') {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      next();
    },
    requireStaff,
    (req: Request, res: Response) => {
      return controller.testRazorpayWebhook(req, res);
    },
  );

  // GET /webhooks/health
  // Health check
  router.get('/health', (req: Request, res: Response) => {
    return controller.webhookHealth(req, res);
  });

  return router;
}
