/**
 * Audit Service
 * Logs all sensitive payment operations for compliance and debugging
 *
 * Phase 9d: Security & Authorization
 */

import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuthContext } from '../middleware/authorization.middleware';
import { getDataSource } from '../database/postgres-data-source';

/**
 * Audit Log Entry
 */
export interface AuditEntry {
  storeId: string;
  actor?: AuthContext;
  resourceType: 'payment' | 'refund' | 'webhook';
  resourceId: string;
  action: string;
  oldState?: Record<string, any>;
  newState: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  context?: Record<string, any>;
  status: 'success' | 'failure';
  errorMessage?: string;
  source: 'api' | 'webhook' | 'batch' | 'manual';
}

/**
 * Audit Service
 * Appends immutable audit trail for all payment operations
 */
export class AuditService {
  /**
   * Log Payment Operation
   * Records payment creation, confirmation, capture, status updates
   */
  static async logPaymentOperation(entry: AuditEntry): Promise<void> {
    await this.logAudit({
      ...entry,
      resourceType: 'payment',
      action: entry.action,
    });
  }

  /**
   * Log Refund Operation
   * Records refund requests, approvals, rejections, processing
   */
  static async logRefundOperation(entry: AuditEntry): Promise<void> {
    await this.logAudit({
      ...entry,
      resourceType: 'refund',
      action: entry.action,
    });
  }

  /**
   * Log Webhook Event
   * Records incoming webhook events and processing
   */
  static async logWebhookEvent(entry: AuditEntry): Promise<void> {
    await this.logAudit({
      ...entry,
      resourceType: 'webhook',
      source: 'webhook',
    });
  }

  /**
   * Log Admin Action
   * Records admin approvals, rejections, manual operations
   */
  static async logAdminAction(entry: AuditEntry): Promise<void> {
    if (!entry.actor || entry.actor.role !== 'admin') {
      throw new Error('Admin action requires admin authorization context');
    }

    await this.logAudit({
      ...entry,
      source: 'api',
    });
  }

  /**
   * Base Log Method
   * Appends immutable audit entry
   */
  private static async logAudit(entry: AuditEntry): Promise<void> {
    try {
      const dataSource = getDataSource();
      if (!dataSource.isInitialized) {
        console.warn('Audit log skipped: database not initialized');
        return;
      }

      // Create audit log entity
      const auditLog = new AuditLogEntity();
      auditLog.id = this.generateId();
      auditLog.actor_id = entry.actor?.userId || null;
      auditLog.actor_email = entry.actor?.email || null;
      auditLog.actor_role = entry.actor?.role || 'system';
      auditLog.resource_type = entry.resourceType;
      auditLog.resource_id = entry.resourceId;
      auditLog.action = entry.action;
      auditLog.old_state = entry.oldState || null;
      auditLog.new_state = entry.newState;
      auditLog.reason = entry.reason || null;
      auditLog.ip_address = entry.ipAddress || null;
      auditLog.user_agent = entry.userAgent || null;
      auditLog.context = entry.context || null;
      auditLog.status = entry.status;
      auditLog.error_message = entry.errorMessage || null;
      auditLog.source = entry.source;

      // Insert into audit_logs_payment table
      const query = `
        INSERT INTO audit_logs_payment (
          id, store_id, actor_id, actor_email, actor_role,
          resource_type, resource_id, action,
          old_state, new_state, reason,
          ip_address, user_agent, context,
          status, error_message, source,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          $15, $16, $17,
          NOW()
        )
      `;

      const values = [
        auditLog.id,
        entry.storeId,
        auditLog.actor_id,
        auditLog.actor_email,
        auditLog.actor_role,
        auditLog.resource_type,
        auditLog.resource_id,
        auditLog.action,
        auditLog.old_state ? JSON.stringify(auditLog.old_state) : null,
        JSON.stringify(auditLog.new_state),
        auditLog.reason,
        auditLog.ip_address,
        auditLog.user_agent,
        auditLog.context ? JSON.stringify(auditLog.context) : null,
        auditLog.status,
        auditLog.error_message,
        auditLog.source,
      ];

      await dataSource.query(query, values);

      console.log(`[Audit] ${entry.resourceType.toUpperCase()} ${entry.action.toUpperCase()}: ${entry.resourceId}`);
    } catch (error) {
      console.error('Failed to write audit log', {
        error: (error as Error).message,
        entry,
      });
      // Don't throw - audit logging shouldn't block main operations
    }
  }

  /**
   * Get Audit Trail
   * Retrieve audit logs for a resource or time period
   */
  static async getAuditTrail(
    storeId: string,
    resourceId?: string,
    resourceType?: string,
    limit = 100
  ): Promise<AuditLogEntity[]> {
    try {
      const dataSource = getDataSource();
      if (!dataSource.isInitialized) {
        return [];
      }

      let query = `
        SELECT * FROM audit_logs_payment
        WHERE store_id = $1
      `;

      const params: any[] = [storeId];

      if (resourceId) {
        query += ` AND resource_id = $${params.length + 1}`;
        params.push(resourceId);
      }

      if (resourceType) {
        query += ` AND resource_type = $${params.length + 1}`;
        params.push(resourceType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const results = await dataSource.query(query, params);
      return results || [];
    } catch (error) {
      console.error('Failed to retrieve audit trail', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Get Admin Actions
   * Retrieve all admin approvals and rejections
   */
  static async getAdminActions(
    storeId: string,
    resourceType?: string,
    limit = 100
  ): Promise<AuditLogEntity[]> {
    try {
      const dataSource = getDataSource();
      if (!dataSource.isInitialized) {
        return [];
      }

      let query = `
        SELECT * FROM audit_logs_payment
        WHERE store_id = $1 AND actor_role = 'admin'
        AND action IN ('approve', 'reject')
      `;

      const params: any[] = [storeId];

      if (resourceType) {
        query += ` AND resource_type = $${params.length + 1}`;
        params.push(resourceType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const results = await dataSource.query(query, params);
      return results || [];
    } catch (error) {
      console.error('Failed to retrieve admin actions', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Generate unique ID for audit log
   */
  private static generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
