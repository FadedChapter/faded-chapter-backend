/**
 * Dashboard Routes (Public API)
 *
 * Phase 10a: Dashboard endpoints for displaying metrics and charts
 *
 * NOTE: These endpoints are accessible without authentication for development/testing.
 * In production, they should be behind authentication via the admin API.
 */

import { Router, Request, Response } from 'express';
import { PaymentRepository, RefundRepository } from '../repositories/payment.repositories';
import { DashboardService } from '../services/dashboard.service';
import { DashboardController } from '../controllers/dashboard.controller';

export function createDashboardRoutes(): Router {
  const router = Router({ mergeParams: true });

  const paymentRepo = new PaymentRepository();
  const refundRepo = new RefundRepository();
  const dashboardService = new DashboardService(paymentRepo, refundRepo);
  const dashboard = new DashboardController(dashboardService);

  router.get(
    '/metrics',
    (req: Request, res: Response) => dashboard.getMetrics(req, res),
  );

  router.get(
    '/pending-refunds',
    (req: Request, res: Response) => dashboard.getPendingRefunds(req, res),
  );

  router.get(
    '/refund-statistics',
    (req: Request, res: Response) => dashboard.getRefundStatistics(req, res),
  );

  router.get(
    '/admin-actions',
    (req: Request, res: Response) => dashboard.getAdminActions(req, res),
  );

  router.get(
    '/charts/revenue',
    (req: Request, res: Response) => dashboard.getRevenueChart(req, res),
  );

  router.get(
    '/charts/refunds',
    (req: Request, res: Response) => dashboard.getRefundChart(req, res),
  );

  return router;
}
