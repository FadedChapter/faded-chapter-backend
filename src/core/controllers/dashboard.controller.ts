/**
 * Dashboard Controller
 * Handles admin dashboard API endpoints
 *
 * Phase 10a: Admin Dashboard
 */

import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { fixNumericValues } from '../utils/numeric.util.js';

/**
 * Dashboard Controller
 * Provides KPI metrics, refund management, and audit logs
 */
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  /**
   * GET /dashboard/metrics
   * Returns KPI metrics for dashboard
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { days = 30 } = req.query;

      const metrics = await this.dashboardService.getMetrics(
        storeId,
        parseInt(days as string) || 30
      );

      res.status(200).json({
        success: true,
        data: fixNumericValues(metrics),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /dashboard/pending-refunds
   * Returns pending refunds with pagination and filters
   */
  async getPendingRefunds(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { page = 1, limit = 25, minAmount, maxAmount, startDate, endDate } = req.query;

      const filters = {
        ...(minAmount && { minAmount: parseFloat(minAmount as string) }),
        ...(maxAmount && { maxAmount: parseFloat(maxAmount as string) }),
        ...(startDate && { startDate: new Date(startDate as string) }),
        ...(endDate && { endDate: new Date(endDate as string) }),
      };

      const result = await this.dashboardService.getPendingRefunds(
        storeId,
        filters,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 25
      );

      res.status(200).json({
        success: true,
        data: {
          refunds: fixNumericValues(result.refunds),
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            hasMore: result.hasMore,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /dashboard/admin-actions
   * Returns admin actions (approvals/rejections) with pagination
   */
  async getAdminActions(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { page = 1, limit = 50, actionType, resourceType, startDate, endDate } = req.query;

      const filters = {
        ...(actionType && { actionType: actionType as string }),
        ...(resourceType && { resourceType: resourceType as string }),
        ...(startDate && { startDate: new Date(startDate as string) }),
        ...(endDate && { endDate: new Date(endDate as string) }),
      };

      const result = await this.dashboardService.getAdminActions(
        storeId,
        filters,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 50
      );

      res.status(200).json({
        success: true,
        data: {
          actions: result.actions,
          pagination: {
            total: result.total,
            page: Math.ceil(parseInt(page as string) || 1),
            limit: parseInt(limit as string) || 50,
            hasMore: result.hasMore,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /dashboard/charts/revenue
   * Returns revenue trend data for charting
   */
  async getRevenueChart(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { days = 30 } = req.query;

      const chartData = await this.dashboardService.getRevenueChart(
        storeId,
        parseInt(days as string) || 30
      );

      res.status(200).json({
        success: true,
        data: fixNumericValues(chartData),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /dashboard/charts/refunds
   * Returns refund trend data for charting
   */
  async getRefundChart(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { days = 30 } = req.query;

      const chartData = await this.dashboardService.getRefundChart(
        storeId,
        parseInt(days as string) || 30
      );

      res.status(200).json({
        success: true,
        data: fixNumericValues(chartData),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /dashboard/refund-statistics
   * Returns refund count breakdown by status
   */
  async getRefundStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;

      const stats = await this.dashboardService.getRefundStatistics(storeId);

      res.status(200).json({
        success: true,
        data: fixNumericValues(stats),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}
