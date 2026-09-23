/**
 * Audit Log Entity
 * Immutable append-only audit trail for sensitive operations.
 *
 * Core Domain v2.1: Table 11/11
 * Classification: AUDIT HISTORY (append-only, never delete)
 *
 * Note: DB mutation protection via trigger (created in migration)
 * This table is append-only: no UPDATE or DELETE allowed
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index('idx_audit_logs_actor_id', ['actor_id'])
@Index('idx_audit_logs_table_name', ['table_name'])
@Index('idx_audit_logs_record_id', ['record_id'])
@Index('idx_audit_logs_created_at', ['created_at'])
@Index('idx_audit_logs_lookup', ['table_name', 'record_id', 'created_at'])
export class AuditLogEntity {
  // ============================================================================
  // Identity
  // ============================================================================

  @PrimaryColumn('uuid')
  id: string;

  // ============================================================================
  // What Was Changed
  // ============================================================================

  /**
   * The store the change belongs to.
   *
   * Nullable on purpose: the audit trail must never refuse a row. A NOT NULL
   * store scope previously meant every insert failed silently and the trail
   * stayed empty, which is a far worse outcome than a row whose scope is
   * unknown.
   */
  @Column('uuid', { nullable: true })
  store_id: string | null;

  @Column('varchar', { length: 100, nullable: false })
  table_name: string;

  @Column('uuid', { nullable: false })
  record_id: string;

  // ============================================================================
  // Who Did It
  // ============================================================================

  @Column('uuid', { nullable: true })
  actor_id: string | null;

  @Column('varchar', { length: 50, nullable: false })
  actor_type: string;
  // ENUM: customer, staff, system

  // ============================================================================
  // What Changed
  // ============================================================================

  @Column('varchar', { length: 50, nullable: false })
  action: string;
  // ENUM: insert, update, delete

  @Column('jsonb', { nullable: true })
  changes: Record<string, any> | null;
  // {field: {old: ..., new: ...}}

  // ============================================================================
  // Context
  // ============================================================================

  @Column('varchar', { length: 45, nullable: true })
  ip_address: string | null;

  @Column('text', { nullable: true })
  user_agent: string | null;

  // ============================================================================
  // Timestamp (immutable)
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // ============================================================================
  // Retention Policy
  // ============================================================================
  // Immutable append-only. Retention governed by platform's legal/compliance policy.
  // Can be hard-deleted after retention window expires (e.g., 7 years for tax records)
  // But cannot be updated or soft-deleted.
}
