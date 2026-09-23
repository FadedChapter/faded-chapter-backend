/**
 * Verification Token Entity
 * One-time tokens for email verification. Expire after 24 hours.
 *
 * Core Domain v2.1: Table 9/11
 * Composite FK: (customer_id, store_id) → customers(id, store_id)
 *
 * CRITICAL: token_hash ONLY (never raw token)
 * Hard purge policy: Delete after 30 days
 */

import {
  Entity,
  PrimaryColumn,
  Generated,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';

@Entity('verification_tokens')
@Index('uq_verification_tokens_hash', ['token_hash'], { unique: true })
@Index('idx_verification_tokens_customer_id', ['customer_id'])
@Index('idx_verification_tokens_expires_at', ['expires_at'])
export class VerificationTokenEntity {
  // ============================================================================
  // Identity
  // ============================================================================

  @PrimaryColumn('uuid')
  @Generated('uuid')
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
  // Purpose
  // ============================================================================

  @Column('varchar', { length: 50, nullable: false, default: 'email_verification' })
  purpose: string;

  // ============================================================================
  // Email Being Verified
  // ============================================================================

  @Column('varchar', { length: 255, nullable: false })
  email: string;

  // ============================================================================
  // Lifecycle (simplified: consumed_at only, no redundant is_used)
  // ============================================================================

  @Column('timestamptz', { nullable: true })
  consumed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column('timestamptz', { nullable: false })
  expires_at: Date;

  // ============================================================================
  // Retention Policy
  // ============================================================================
  // Hard purge after 30 days (see PHASE_0_SETUP for cleanup job)
}
