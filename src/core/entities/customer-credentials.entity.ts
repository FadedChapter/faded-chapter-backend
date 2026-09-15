/**
 * Customer Credentials Entity
 * Password storage. NEVER visible to customer, NEVER transmitted to client.
 *
 * Core Domain v2.1: Table 7/11
 * Composite FK: (customer_id, store_id) → customers(id, store_id)
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';

@Entity('customer_credentials')
@Index('uq_customer_credentials_customer_id', ['customer_id'], { unique: true })
export class CustomerCredentialsEntity {
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

  @Column('uuid', { nullable: false, unique: true })
  customer_id: string;

  @ManyToOne(() => CustomerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity;

  // Composite FK enforced in migration

  // ============================================================================
  // Password (bcrypt hash only, never plaintext)
  // ============================================================================

  @Column('varchar', { length: 255, nullable: false })
  password_hash: string;

  // ============================================================================
  // Metadata
  // ============================================================================

  @Column('varchar', { length: 50, nullable: false, default: 'bcrypt' })
  hash_algorithm: string;

  @Column('integer', { nullable: false, default: 1 })
  hash_version: number;

  // ============================================================================
  // Status
  // ============================================================================

  @Column('boolean', { nullable: false, default: true })
  is_active: boolean;

  // ============================================================================
  // Security Tracking
  // ============================================================================

  @Column('timestamptz', { nullable: true })
  last_login_at: Date | null;

  @Column('integer', { nullable: false, default: 0 })
  failed_login_attempts: number;

  @Column('timestamptz', { nullable: true })
  locked_until: Date | null;

  // ============================================================================
  // Audit
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column('timestamptz', { nullable: true })
  password_changed_at: Date | null;
}
