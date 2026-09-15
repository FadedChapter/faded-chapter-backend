/**
 * Payment Routes
 * Handles all payment and refund API endpoints
 *
 * Phase 9: Payment Processing
 */

import { Router, Request, Response } from 'express';
import { PaymentProcessingService } from '../services/payment-processing.service';
import { RefundService } from '../services/refund.service';
import { PaymentController } from '../controllers/payment.controller';

/**
 * Create Payment Routes
 * All routes prefixed with /api/v1/stores/:storeId/payments
 */
export function createPaymentRoutes(
  paymentService: PaymentProcessingService,
  refundService: RefundService
): Router {
  const router = Router({ mergeParams: true });
  const controller = new PaymentController(paymentService, refundService);

  /**
   * Payment Intent & Confirmation
   */

  // POST /payments/intents
  router.post('/intents', (req: Request, res: Response) => {
    return controller.createPaymentIntent(req, res);
  });

  // POST /payments/confirm
  router.post('/confirm', (req: Request, res: Response) => {
    return controller.confirmPayment(req, res);
  });

  // GET /payments/:paymentId
  router.get('/:paymentId', (req: Request, res: Response) => {
    return controller.getPayment(req, res);
  });

  // POST /payments/:paymentId/capture
  router.post('/:paymentId/capture', (req: Request, res: Response) => {
    return controller.capturePayment(req, res);
  });

  /**
   * Payment Queries & Listing
   */

  // GET /payments?customer_id=:customerId&limit=50&offset=0
  router.get('/', (req: Request, res: Response) => {
    return controller.listPayments(req, res);
  });

  /**
   * Refund Eligibility & Requests
   */

  // GET /payments/:paymentId/refund-eligibility
  router.get('/:paymentId/refund-eligibility', (req: Request, res: Response) => {
    return controller.getRefundEligibility(req, res);
  });

  // POST /payments/:paymentId/refunds
  router.post('/:paymentId/refunds', (req: Request, res: Response) => {
    return controller.requestRefund(req, res);
  });

  // GET /payments/:paymentId/refunds
  router.get('/:paymentId/refunds', (req: Request, res: Response) => {
    return controller.listRefundsForPayment(req, res);
  });

  /**
   * Refund Management (Admin)
   */

  // GET /refunds/:refundId
  router.get('/refunds/:refundId', (req: Request, res: Response) => {
    return controller.getRefund(req, res);
  });

  // GET /refunds?status=pending_approval&limit=50&offset=0
  router.get('/refunds/', (req: Request, res: Response) => {
    return controller.listRefundsByStatus(req, res);
  });

  // POST /refunds/:refundId/approve
  router.post('/refunds/:refundId/approve', (req: Request, res: Response) => {
    return controller.approveRefund(req, res);
  });

  // POST /refunds/:refundId/reject
  router.post('/refunds/:refundId/reject', (req: Request, res: Response) => {
    return controller.rejectRefund(req, res);
  });

  /**
   * Admin Dashboard Endpoints
   */

  // GET /refunds/dashboard/pending
  router.get('/dashboard/pending', (req: Request, res: Response) => {
    return controller.getPendingRefunds(req, res);
  });

  // GET /refunds/dashboard/statistics
  router.get('/dashboard/statistics', (req: Request, res: Response) => {
    return controller.getRefundStatistics(req, res);
  });

  return router;
}
