/**
 * Secure Payment Controller
 * Payment endpoints with authorization and audit logging
 *
 * Phase 9d: Security & Authorization
 */

import { Request, Response } from 'express';
import { PaymentProcessingService } from '../services/payment-processing.service';
import { RefundService } from '../services/refund.service';
import { AuditService } from '../services/audit.service';
import { AuthContext } from '../middleware/authorization.middleware';
import { CreatePaymentIntentDto, ConfirmPaymentDto } from '../dtos/payment.dto';

/**
 * Secure Payment Controller
 * Extends base payment controller with authorization and audit logging
 */
export class SecurePaymentController {
  constructor(
    private paymentService: PaymentProcessingService,
    private refundService: RefundService
  ) {}

  /**
   * Approve Refund (Admin Only)
   * Protected endpoint - logs all approvals
   */
  async approveRefund(req: Request, res: Response): Promise<void> {
    try {
      const auth = req.auth as AuthContext;
      const { storeId, refundId } = req.params;
      const { approval_notes } = req.body;

      // Get refund before approval (for audit trail)
      const refund = await this.refundService.getRefund(storeId, refundId);

      // Approve refund
      const approvedRefund = await this.refundService.approveRefund(storeId, {
        refund_id: refundId,
        approved_by: auth.userId,
        approval_notes,
      });

      // Log admin action
      await AuditService.logAdminAction({
        storeId,
        actor: auth,
        resourceType: 'refund',
        resourceId: refundId,
        action: 'approve',
        oldState: {
          status: refund.status,
          approved_by: refund.approved_by,
        },
        newState: {
          status: approvedRefund.status,
          approved_by: approvedRefund.approved_by,
        },
        reason: approval_notes,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
        source: 'api',
      });

      res.status(200).json({
        success: true,
        refund: this.refundService.toResponseDto(approvedRefund),
      });
    } catch (error) {
      const auth = req.auth as AuthContext;

      // Log failed action
      await AuditService.logAdminAction({
        storeId: req.params.storeId,
        actor: auth,
        resourceType: 'refund',
        resourceId: req.params.refundId,
        action: 'approve',
        newState: {},
        status: 'failure',
        errorMessage: (error as Error).message,
        source: 'api',
      }).catch(() => {}); // Ignore audit log errors

      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Reject Refund (Admin Only)
   * Protected endpoint - logs all rejections
   */
  async rejectRefund(req: Request, res: Response): Promise<void> {
    try {
      const auth = req.auth as AuthContext;
      const { storeId, refundId } = req.params;
      const { reason } = req.body;

      // Get refund before rejection (for audit trail)
      const refund = await this.refundService.getRefund(storeId, refundId);

      // Reject refund
      const rejectedRefund = await this.refundService.rejectRefund(storeId, {
        refund_id: refundId,
        reason,
      });

      // Log admin action
      await AuditService.logAdminAction({
        storeId,
        actor: auth,
        resourceType: 'refund',
        resourceId: refundId,
        action: 'reject',
        oldState: {
          status: refund.status,
        },
        newState: {
          status: rejectedRefund.status,
        },
        reason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success',
        source: 'api',
      });

      res.status(200).json({
        success: true,
        refund: this.refundService.toResponseDto(rejectedRefund),
      });
    } catch (error) {
      const auth = req.auth as AuthContext;

      // Log failed action
      await AuditService.logAdminAction({
        storeId: req.params.storeId,
        actor: auth,
        resourceType: 'refund',
        resourceId: req.params.refundId,
        action: 'reject',
        newState: {},
        status: 'failure',
        errorMessage: (error as Error).message,
        source: 'api',
      }).catch(() => {});

      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get Audit Trail (Admin Only)
   * View payment/refund operation history
   */
  async getAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, resourceId, resourceType } = req.params;
      const { limit = '100' } = req.query;

      const auditTrail = await AuditService.getAuditTrail(
        storeId,
        resourceId,
        resourceType as any,
        parseInt(limit as string)
      );

      res.status(200).json({
        success: true,
        auditTrail: auditTrail.map((log) => ({
          id: log.id,
          actor: log.actor_email,
          action: log.action,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          status: log.status,
          reason: log.reason,
          newState: log.new_state,
          createdAt: log.created_at,
        })),
        total: auditTrail.length,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get Admin Actions (Admin Only)
   * View all admin approvals and rejections
   */
  async getAdminActions(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { resourceType, limit = '100' } = req.query;

      const actions = await AuditService.getAdminActions(
        storeId,
        resourceType as any,
        parseInt(limit as string)
      );

      res.status(200).json({
        success: true,
        actions: actions.map((log) => ({
          id: log.id,
          admin: log.actor_email,
          action: log.action,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          reason: log.reason,
          timestamp: log.created_at,
        })),
        total: actions.length,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}
