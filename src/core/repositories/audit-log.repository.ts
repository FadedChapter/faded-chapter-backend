/**
 * Audit Log Repository
 * Immutable append-only audit trail
 *
 * Phase 2: Repository implementation
 */

import { BaseRepository } from '../repository/base-repository';
import { AuditLogEntity } from '../entities/audit-log.entity';

export class AuditLogRepository extends BaseRepository<AuditLogEntity> {
  constructor() {
    super(AuditLogEntity);
  }

  /**
   * Create audit log entry (append-only, immutable)
   * CRITICAL: Database trigger prevents mutations
   */
  async createEntry(
    storeId: string,
    data: {
      tableName: string;
      recordId: string;
      actorId: string;
      actorType: 'customer' | 'staff' | 'system';
      action: 'insert' | 'update' | 'delete';
      changes: Record<string, { old: any; new: any }>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<AuditLogEntity> {
    const entry = this.repository.create({
      store_id: storeId,
      table_name: data.tableName,
      record_id: data.recordId,
      actor_id: data.actorId,
      actor_type: data.actorType,
      action: data.action,
      changes: data.changes,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      created_at: new Date(),
    });

    return this.save(entry);
  }

  /**
   * Get audit trail for a record
   */
  async getRecordHistory(
    storeId: string,
    tableName: string,
    recordId: string
  ): Promise<AuditLogEntity[]> {
    try {
      return await this.repository.find({
        where: {
          store_id: storeId,
          table_name: tableName,
          record_id: recordId,
        } as any,
        order: { created_at: 'ASC' } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get record history: ${(error as Error).message}`);
    }
  }

  /**
   * Get audit trail for a customer
   */
  async getCustomerHistory(
    storeId: string,
    customerId: string,
    limit = 50
  ): Promise<AuditLogEntity[]> {
    try {
      return await this.repository.find({
        where: {
          store_id: storeId,
          actor_id: customerId,
        } as any,
        order: { created_at: 'DESC' } as any,
        take: limit,
      });
    } catch (error) {
      throw new Error(`Failed to get customer history: ${(error as Error).message}`);
    }
  }

  /**
   * IMPORTANT: Audit logs are IMMUTABLE
   * Update and delete operations are BLOCKED at database level via trigger
   * This method should never be called
   */
  async update(): Promise<any> {
    throw new Error('Audit logs are immutable and cannot be updated');
  }

  /**
   * IMPORTANT: Audit logs are IMMUTABLE
   * This method should never be called
   */
  async delete(): Promise<any> {
    throw new Error('Audit logs are immutable and cannot be deleted');
  }
}
