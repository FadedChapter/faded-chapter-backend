/**
 * Admin Payment Controller
 *
 * Phase 6: Payments.
 *
 * Supersedes payment-secure.controller.ts, which was written for this purpose
 * but never mounted: it mixed customer and admin endpoints on one router, and
 * its two audit-reading methods read AuditLogEntity.actor_email / .resource_type
 * / .resource_id, none of which exist on that entity. Those two methods also
 * duplicated the dashboard's working /dashboard/admin-actions. The refund
 * actions are reimplemented here behind the full admin chain.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission).
 */

import { Request, Response } from 'express';
import { PaymentRepository, RefundRepository } from '../repositories/payment.repositories';
import { toAdminPaymentDTO, toAdminRefundDTO } from '../dto/payment.dto';
import { toAdminTransactionDTO } from '../dto/transaction.dto';
import { logError, logInfo } from '../logging/logger';

/**
 * Refund states this console can move a refund out of.
 *
 * Only a refund awaiting a decision can be approved or rejected. Re-approving
 * an already-approved refund is how money gets sent twice, so the guard is a
 * state check rather than a permission check alone.
 */
const AWAITING_DECISION = 'pending_approval';

function parseIntOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AdminPaymentController {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly refunds: RefundRepository,
  ) {}

  /** GET /payments — transactions list. */
  async listTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const page = Math.max(parseIntOr(req.query['page'], 1), 1);
      const limit = Math.min(Math.max(parseIntOr(req.query['limit'], 25), 1), 100);

      const { rows, total } = await this.payments.searchPayments(storeId, {
        status: (req.query['status'] as string) || undefined,
        search: (req.query['search'] as string) || undefined,
        limit,
        offset: (page - 1) * limit,
      });

      res.status(200).json({
        success: true,
        data: {
          transactions: rows.map(toAdminTransactionDTO),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
          },
        },
      });
    } catch (error) {
      logError('admin_payment_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load transactions' });
    }
  }

  /** GET /payments/summary — status counts and captured/refunded totals. */
  async summary(req: Request, res: Response): Promise<void> {
    try {
      const summary = await this.payments.transactionSummary(req.params.storeId);
      res.status(200).json({
        success: true,
        data: {
          counts: summary.counts,
          capturedValue: summary.capturedValue,
          refundedValue: summary.refundedValue,
          // Stated rather than left to the client: the console and any report
          // built on this endpoint should agree on what "net" means.
          netValue: summary.capturedValue - summary.refundedValue,
        },
      });
    } catch (error) {
      logError('admin_payment_summary_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load payment summary' });
    }
  }

  /** GET /payments/:paymentId — one transaction with its refunds. */
  async detail(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, paymentId } = req.params;

      const payment = await this.payments.findOneScoped(paymentId, storeId);
      if (!payment) {
        res.status(404).json({ success: false, error: 'Payment not found' });
        return;
      }

      const refunds = await this.refunds.findByPayment(paymentId, storeId);

      res.status(200).json({
        success: true,
        data: {
          ...toAdminPaymentDTO(payment),
          refunds: refunds.map(toAdminRefundDTO),
        },
      });
    } catch (error) {
      logError('admin_payment_detail_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load payment' });
    }
  }

  /** GET /payments/refunds/pending — the approval queue. */
  async pendingRefunds(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const limit = Math.min(Math.max(parseIntOr(req.query['limit'], 50), 1), 100);
      const pending = await this.refunds.findByStatus(AWAITING_DECISION, storeId, limit, 0);
      res.status(200).json({
        success: true,
        data: pending.map(toAdminRefundDTO),
      });
    } catch (error) {
      logError('admin_refund_pending_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load pending refunds' });
    }
  }

  /**
   * POST /payments/refunds/:refundId/approve
   *
   * Approving sends money back to a customer. Two guards, both server-side:
   * the refund must still be awaiting a decision, and the approver is taken
   * from the verified token rather than the request body — otherwise the
   * record of who authorised the payout is whatever the caller claimed.
   */
  async approveRefund(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, refundId } = req.params;

      const refund = await this.refunds.findOneScoped(refundId, storeId);
      if (!refund) {
        res.status(404).json({ success: false, error: 'Refund not found' });
        return;
      }

      const current = (refund as unknown as { status: string }).status;
      if (current !== AWAITING_DECISION) {
        // Not merely idempotent: approving twice is how a customer is refunded
        // twice, so this is a hard conflict rather than a silent no-op.
        res.status(409).json({
          success: false,
          error: `Refund is ${current} and is no longer awaiting a decision`,
        });
        return;
      }

      const approverId = req.auth?.userId;
      if (!approverId) {
        // Unreachable behind the admin router, but approving a payout without
        // an attributable approver must fail rather than proceed anonymously.
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const updated = await this.refunds.approve(refundId, storeId, approverId);

      logInfo('refund_approved', {
        refundId,
        storeId,
        approverId,
        approverEmail: req.auth?.email ?? null,
        amount: (refund as unknown as { amount: number }).amount,
        paymentId: (refund as unknown as { payment_id: string }).payment_id,
      });

      res.status(200).json({ success: true, data: toAdminRefundDTO(updated) });
    } catch (error) {
      logError('admin_refund_approve_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to approve refund' });
    }
  }

  /**
   * POST /payments/refunds/:refundId/reject
   * Body: { reason: string }
   */
  async rejectRefund(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, refundId } = req.params;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      if (reason.length < 3) {
        // A rejection the customer may query later is worth a sentence; an
        // empty string leaves whoever handles the complaint with nothing.
        res.status(400).json({
          success: false,
          error: 'A reason of at least 3 characters is required to reject a refund',
        });
        return;
      }

      const refund = await this.refunds.findOneScoped(refundId, storeId);
      if (!refund) {
        res.status(404).json({ success: false, error: 'Refund not found' });
        return;
      }

      const current = (refund as unknown as { status: string }).status;
      if (current !== AWAITING_DECISION) {
        res.status(409).json({
          success: false,
          error: `Refund is ${current} and is no longer awaiting a decision`,
        });
        return;
      }

      const updated = await this.refunds.reject(refundId, storeId, reason.slice(0, 500));

      logInfo('refund_rejected', {
        refundId,
        storeId,
        actorId: req.auth?.userId ?? null,
        actorEmail: req.auth?.email ?? null,
        reason: reason.slice(0, 500),
      });

      res.status(200).json({ success: true, data: toAdminRefundDTO(updated) });
    } catch (error) {
      logError('admin_refund_reject_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to reject refund' });
    }
  }
}
