/**
 * Dashboard Service
 * Provides metrics, analytics, and data aggregation for admin dashboard
 *
 * Phase 10a: Admin Dashboard
 */

import { PaymentEntity } from '../entities/payment.entity';
import { RefundEntity } from '../entities/refund.entity';
import {
  PaymentRepository,
  RefundRepository,
} from '../repositories/payment.repositories';
import { AuditService, type AdminActionRecord } from './audit.service';

/**
 * KPI Metrics for Dashboard
 */
export interface KPIMetrics {
  revenue: {
    total: number;
    count: number;
    average: number;
    period: string;
  };
  refunds: {
    pending_count: number;
    pending_amount: number;
    approved_count: number;
    approved_amount: number;
    rejected_count: number;
    rejected_amount: number;
    refund_rate: number;
  };
  payments: {
    successful_count: number;
    successful_rate: number;
    failed_count: number;
    failed_rate: number;
    total_processed: number;
  };
  timestamp: Date;
}

/**
 * Refund Page Data (with pagination)
 */
export interface RefundPage {
  refunds: RefundEntity[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Chart Data Point
 */
export interface ChartDataPoint {
  date: string;
  value: number;
  count?: number;
}

/**
 * Chart Data
 */
export interface ChartData {
  data: ChartDataPoint[];
  period: string;
  total: number;
  average: number;
}

/**
 * Admin Action Record
 */
export interface AdminAction {
  id: string;
  created_at: Date;
  actor_email?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  reason?: string;
  status: string;
}

/**
 * Dashboard Service
 * Aggregates data from multiple repositories for dashboard views
 */
export class DashboardService {
  constructor(
    private paymentRepo: PaymentRepository,
    private refundRepo: RefundRepository
  ) {}

  /**
   * Get KPI Metrics
   * Returns key performance indicators for dashboard
   */
  async getMetrics(storeId: string, days: number = 30): Promise<KPIMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get payments for period
    const payments = await this.paymentRepo.findByDateRange(storeId, startDate, new Date());

    // Get refunds for period
    const refunds = await this.refundRepo.findByDateRange(storeId, startDate, new Date());

    // Calculate revenue
    const successfulPayments = payments.filter((p) => p.status === 'captured');
    const totalRevenue = successfulPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const avgRevenue = successfulPayments.length > 0 ? totalRevenue / successfulPayments.length : 0;

    // Calculate refunds
    const pendingRefunds = refunds.filter((r) => r.status === 'pending_approval');
    const approvedRefunds = refunds.filter((r) => r.status === 'approved');
    const rejectedRefunds = refunds.filter((r) => r.status === 'rejected');

    const pendingRefundAmount = pendingRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);
    const approvedRefundAmount = approvedRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);
    const rejectedRefundAmount = rejectedRefunds.reduce((sum, r) => sum + (r.amount || 0), 0);

    const refundRate =
      payments.length > 0 ? (refunds.length / payments.length) * 100 : 0;

    // Calculate payment stats
    const failedPayments = payments.filter(
      (p) => p.status === 'failed' || p.status === 'cancelled'
    );
    const successfulRate =
      payments.length > 0 ? (successfulPayments.length / payments.length) * 100 : 0;
    const failedRate = 100 - successfulRate;

    return {
      revenue: {
        total: totalRevenue,
        count: successfulPayments.length,
        average: avgRevenue,
        period: `Last ${days} days`,
      },
      refunds: {
        pending_count: pendingRefunds.length,
        pending_amount: pendingRefundAmount,
        approved_count: approvedRefunds.length,
        approved_amount: approvedRefundAmount,
        rejected_count: rejectedRefunds.length,
        rejected_amount: rejectedRefundAmount,
        refund_rate: refundRate,
      },
      payments: {
        successful_count: successfulPayments.length,
        successful_rate: successfulRate,
        failed_count: failedPayments.length,
        failed_rate: failedRate,
        total_processed: payments.length,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get Pending Refunds
   * Returns paginated list of pending refunds awaiting approval
   */
  async getPendingRefunds(
    storeId: string,
    filters?: {
      status?: string;
      minAmount?: number;
      maxAmount?: number;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    limit: number = 25
  ): Promise<RefundPage> {
    let allRefunds = await this.refundRepo.findByStatus('pending_approval', storeId, 1000, 0);

    // Apply filters
    if (filters) {
      if (filters.minAmount) {
        allRefunds = allRefunds.filter((r) => (r.amount || 0) >= filters.minAmount!);
      }
      if (filters.maxAmount) {
        allRefunds = allRefunds.filter((r) => (r.amount || 0) <= filters.maxAmount!);
      }
      if (filters.startDate) {
        allRefunds = allRefunds.filter((r) => r.created_at >= filters.startDate!);
      }
      if (filters.endDate) {
        allRefunds = allRefunds.filter((r) => r.created_at <= filters.endDate!);
      }
    }

    // Sort by created date descending (newest first)
    allRefunds.sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0));

    const total = allRefunds.length;
    const offset = (page - 1) * limit;
    const refunds = allRefunds.slice(offset, offset + limit);

    return {
      refunds,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get Admin Actions
   * Returns audit log entries for admin actions (approvals, rejections)
   */
  async getAdminActions(
    storeId: string,
    filters?: {
      actionType?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    limit: number = 50
  ): Promise<{ actions: AdminActionRecord[]; total: number; hasMore: boolean }> {
    // Query admin actions from audit service
    const auditLogs = await AuditService.getAdminActions(
      storeId,
      filters?.resourceType,
      1000
    );

    // Filter for action type if specified
    let filteredLogs = auditLogs;
    if (filters?.actionType) {
      filteredLogs = filteredLogs.filter((log: any) => log.action === filters.actionType);
    }

    // Apply date filters
    if (filters?.startDate) {
      filteredLogs = filteredLogs.filter((log: any) => new Date(log.created_at) >= filters.startDate!);
    }
    if (filters?.endDate) {
      filteredLogs = filteredLogs.filter((log: any) => new Date(log.created_at) <= filters.endDate!);
    }

    // Sort by created date descending (newest first)
    filteredLogs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filteredLogs.length;
    const offset = (page - 1) * limit;
    const actions = filteredLogs.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { actions, total, hasMore };
  }

  /**
   * Get Revenue Chart Data
   * Returns revenue trend data for charting
   */
  async getRevenueChart(storeId: string, days: number = 30): Promise<ChartData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await this.paymentRepo.findByDateRange(storeId, startDate, new Date());

    // Group by date
    const dailyRevenue: Record<string, { total: number; count: number }> = {};

    payments.forEach((payment) => {
      if (payment.status === 'captured') {
        const dateStr = payment.created_at?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
        if (!dailyRevenue[dateStr]) {
          dailyRevenue[dateStr] = { total: 0, count: 0 };
        }
        dailyRevenue[dateStr].total += payment.amount || 0;
        dailyRevenue[dateStr].count += 1;
      }
    });

    // Convert to chart data
    const chartData: ChartDataPoint[] = Object.entries(dailyRevenue)
      .map(([date, data]) => ({
        date,
        value: data.total,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const total = Object.values(dailyRevenue).reduce((sum, d) => sum + d.total, 0);
    const average = chartData.length > 0 ? total / chartData.length : 0;

    return {
      data: chartData,
      period: `Last ${days} days`,
      total,
      average,
    };
  }

  /**
   * Get Refund Chart Data
   * Returns refund trend data for charting
   */
  async getRefundChart(storeId: string, days: number = 30): Promise<ChartData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const refunds = await this.refundRepo.findByDateRange(storeId, startDate, new Date());

    // Group by date
    const dailyRefunds: Record<string, { total: number; count: number }> = {};

    refunds.forEach((refund) => {
      if (refund.status === 'succeeded') {
        const dateStr = refund.created_at?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
        if (!dailyRefunds[dateStr]) {
          dailyRefunds[dateStr] = { total: 0, count: 0 };
        }
        dailyRefunds[dateStr].total += refund.amount || 0;
        dailyRefunds[dateStr].count += 1;
      }
    });

    // Convert to chart data
    const chartData: ChartDataPoint[] = Object.entries(dailyRefunds)
      .map(([date, data]) => ({
        date,
        value: data.total,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const total = Object.values(dailyRefunds).reduce((sum, d) => sum + d.total, 0);
    const average = chartData.length > 0 ? total / chartData.length : 0;

    return {
      data: chartData,
      period: `Last ${days} days`,
      total,
      average,
    };
  }

  /**
   * Get Refund Statistics
   * Returns count breakdown by status
   */
  async getRefundStatistics(
    storeId: string
  ): Promise<{
    pending_approval: number;
    approved: number;
    rejected: number;
    succeeded: number;
    failed: number;
    total_amount: number;
  }> {
    const allRefunds = await this.refundRepo.findByStatus('pending_approval', storeId, 10000, 0);
    const approvedRefunds = await this.refundRepo.findByStatus('approved', storeId, 10000, 0);
    const rejectedRefunds = await this.refundRepo.findByStatus('rejected', storeId, 10000, 0);
    const succeededRefunds = await this.refundRepo.findByStatus('succeeded', storeId, 10000, 0);
    const failedRefunds = await this.refundRepo.findByStatus('failed', storeId, 10000, 0);

    const totalAmount = [
      ...allRefunds,
      ...approvedRefunds,
      ...rejectedRefunds,
      ...succeededRefunds,
      ...failedRefunds,
    ].reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      pending_approval: allRefunds.length,
      approved: approvedRefunds.length,
      rejected: rejectedRefunds.length,
      succeeded: succeededRefunds.length,
      failed: failedRefunds.length,
      total_amount: totalAmount,
    };
  }
}
