/**
 * Session Entity
 * Authenticated sessions. Revocable, multi-device.
 *
 * Core Domain v2.1: Table 8/11
 * Composite FK: (customer_id, store_id) → customers(id, store_id)
 *
 * CRITICAL: token_hash ONLY (never raw token)
 */

import {
  Entity,
  PrimaryColumn,
  Generated,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';

@Entity('sessions')
@Index('idx_sessions_customer_id', ['customer_id'])
@Index('uq_sessions_token_hash', ['token_hash'], { unique: true })
@Index('idx_sessions_active', ['customer_id', 'is_active'], {
  where: 'is_active = true'
})
@Index('idx_sessions_expires_at', ['expires_at'], {
  where: 'is_active = true'
})
export class SessionEntity {
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
  // Device Info
  // ============================================================================

  @Column('varchar', { length: 45, nullable: false })
  ip_address: string;

  @Column('text', { nullable: true })
  user_agent: string | null;

  @Column('varchar', { length: 50, nullable: true })
  device_type: string | null;
  // ENUM: web, mobile, desktop

  @Column('varchar', { length: 255, nullable: true })
  device_name: string | null;

  // ============================================================================
  // Status
  // ============================================================================

  @Column('boolean', { nullable: false, default: true })
  is_active: boolean;

  // ============================================================================
  // Validity
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column('timestamptz', { nullable: false })
  last_activity_at: Date;

  @Column('timestamptz', { nullable: false })
  expires_at: Date;

  @Column('timestamptz', { nullable: true })
  revoked_at: Date | null;
}
