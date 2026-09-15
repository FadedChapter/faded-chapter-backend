/**
 * Secure Payment Routes
 * Payment endpoints with authorization and rate limiting
 *
 * Phase 9d: Security & Authorization
 */

import { Router, Request, Response } from 'express';
import { PaymentProcessingService } from '../services/payment-processing.service';
import { RefundService } from '../services/refund.service';
import { SecurePaymentController } from '../controllers/payment-secure.controller';
import {
  requireRole,
  requirePermission,
  checkStoreOwnership,
  AuthContext,
} from '../middleware/authorization.middleware';
import {
  paymentCreationRateLimit,
  refundRateLimit,
  apiRateLimit,
} from '../middleware/rate-limit.middleware';

/**
 * Create Secure Payment Routes
 * All routes include authorization and rate limiting
 */
export function createSecurePaymentRoutes(
  paymentService: PaymentProcessingService,
  refundService: RefundService
): Router {
  const router = Router({ mergeParams: true });
  const controller = new SecurePaymentController(paymentService, refundService);

  /**
   * === CUSTOMER ENDPOINTS ===
   * Can create payments and request refunds
   */

  /**
   * POST /stores/:storeId/payments/intents
   * Create payment intent (customer or admin)
   */
  router.post(
    '/intents',
    apiRateLimit,
    paymentCreationRateLimit,
    checkStoreOwnership,
    async (req: Request, res: Response) => {
      // Endpoint implemented in base payment controller
      res.status(501).json({ error: 'See payment.controller.ts' });
    }
  );

  /**
   * === ADMIN ENDPOINTS ===
   * Only admins can approve/reject refunds
   */

  /**
   * POST /refunds/:refundId/approve
   * Admin approve refund (admin only)
   */
  router.post(
    '/refunds/:refundId/approve',
    requireRole('admin'),
    requirePermission('refund.approve'),
    refundRateLimit,
    checkStoreOwnership,
    async (req: Request, res: Response) => {
      return controller.approveRefund(req, res);
    }
  );

  /**
   * POST /refunds/:refundId/reject
   * Admin reject refund (admin only)
   */
  router.post(
    '/refunds/:refundId/reject',
    requireRole('admin'),
    requirePermission('refund.reject'),
    refundRateLimit,
    checkStoreOwnership,
    async (req: Request, res: Response) => {
      return controller.rejectRefund(req, res);
    }
  );

  /**
   * === AUDIT & COMPLIANCE ENDPOINTS ===
   * View operation history (admin or support)
   */

  /**
   * GET /audit/trail/:resourceId
   * View audit trail for payment or refund (admin/support only)
   */
  router.get(
    '/audit/trail/:resourceId',
    requireRole('admin', 'support'),
    requirePermission('audit.view'),
    apiRateLimit,
    checkStoreOwnership,
    async (req: Request, res: Response) => {
      const { storeId, resourceId } = req.params;
      const { resourceType } = req.query;

      return controller.getAuditTrail(
        {
          ...req,
          params: { ...req.params, storeId, resourceId, resourceType },
        } as Request,
        res
      );
    }
  );

  /**
   * GET /audit/admin-actions
   * View admin approvals and rejections (admin only)
   */
  router.get(
    '/audit/admin-actions',
    requireRole('admin'),
    requirePermission('audit.view'),
    apiRateLimit,
    checkStoreOwnership,
    async (req: Request, res: Response) => {
      return controller.getAdminActions(req, res);
    }
  );

  /**
   * === AUTHORIZATION SUMMARY ===
   *
   * Customer:
   *   - payment.create
   *   - payment.confirm
   *   - refund.request
   *   - payment.view-own
   *
   * Admin:
   *   - payment.create (manual)
   *   - payment.confirm
   *   - payment.capture
   *   - payment.view-all
   *   - refund.request
   *   - refund.approve ✓ (Protected)
   *   - refund.reject ✓ (Protected)
   *   - refund.view-all
   *   - audit.view ✓ (Protected)
   *
   * Support:
   *   - payment.view-all
   *   - refund.view-all
   *   - refund.request
   *   - audit.view ✓ (Protected)
   *
   * System:
   *   - All operations (webhook processing, batch)
   *
   * === RATE LIMITS ===
   *
   * Payment Creation: 30 req/min per user
   * Refund Operations: 20 req/min (admin only)
   * General API: 100 req/min per user
   * Webhook: 1000 req/min per store
   *
   * === AUDIT LOGGING ===
   *
   * All admin actions logged:
   *   - refund.approve
   *   - refund.reject
   *
   * Audit trail includes:
   *   - Actor (admin email, role)
   *   - Action (approve, reject)
   *   - Resource (payment, refund, id)
   *   - Old and new state
   *   - Reason/notes
   *   - Timestamp
   *   - IP address and user agent
   */

  return router;
}
