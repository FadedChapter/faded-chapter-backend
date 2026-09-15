/**
 * Password Reset Token Entity
 * One-time tokens for password reset. Expire after 24 hours. Brute-force protected.
 *
 * Core Domain v2.1: Table 10/11
 * Composite FK: (customer_id, store_id) → customers(id, store_id)
 *
 * CRITICAL: token_hash ONLY (never raw token)
 * Hard purge policy: Delete after 30 days
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';

@Entity('password_reset_tokens')
@Index('uq_password_reset_tokens_hash', ['token_hash'], { unique: true })
@Index('idx_password_reset_tokens_customer_id', ['customer_id'])
@Index('idx_password_reset_tokens_expires_at', ['expires_at'])
export class PasswordResetTokenEntity {
  // ============================================================================
  // Identity
  // ============================================================================

  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { nullable: false })
  store_id: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: StoreEntity;

  @Column('uuid', { nullable: false })
  customer_id: string;

  @ManyToOne(() => CustomerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity;

  // Composite FK enforced in migration

  // ============================================================================
  // Token (HASH ONLY, never raw token)
  // ============================================================================

  @Column('varchar', { length: 255, nullable: false, unique: true })
  token_hash: string;

  // ============================================================================
  // Email Requesting Reset
  // ============================================================================

  @Column('varchar', { length: 255, nullable: false })
  email: string;

  // ============================================================================
  // Lifecycle (simplified: consumed_at only)
  // ============================================================================

  @Column('timestamptz', { nullable: true })
  consumed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column('timestamptz', { nullable: false })
  expires_at: Date;

  // ============================================================================
  // Brute Force Protection
  // ============================================================================

  @Column('integer', { nullable: false, default: 0 })
  attempt_count: number;

  @Column('integer', { nullable: false, default: 3 })
  max_attempts: number;

  // ============================================================================
  // Audit
  // ============================================================================

  @Column('varchar', { length: 45, nullable: true })
  requested_ip_address: string | null;

  @Column('varchar', { length: 45, nullable: true })
  used_ip_address: string | null;

  // ============================================================================
  // Retention Policy
  // ============================================================================
  // Hard purge after 30 days (see PHASE_0_SETUP for cleanup job)
}
