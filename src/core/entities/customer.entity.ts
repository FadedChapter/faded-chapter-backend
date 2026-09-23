/**
 * Customer Entity
 * Customer account identity. Core record for all customer-related data.
 *
 * Core Domain v2.1: Table 3/11
 * Composite PK: (id, store_id) for store isolation
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

@Entity('customers')
@Index('idx_customers_store_id', ['store_id'])
@Index('idx_customers_status', ['store_id', 'status'])
@Index('idx_customers_created_at', ['store_id', 'created_at'])
@Index('uq_customers_store_email_active', ['store_id', 'email_normalized'], {
  unique: true,
  where: 'deleted_at IS NULL'
})
export class CustomerEntity {
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

  // Composite FK for stronger ownership
  @Index('uq_customer_composite', { unique: true })
  // Note: TypeORM doesn't directly support composite PKs without TypeORM >= 0.3
  // Composite FK enforced in migration

  // ============================================================================
  // Contact
  // ============================================================================

  @Column('varchar', { length: 255, nullable: false })
  email: string;

  @Column('varchar', { length: 255, nullable: false })
  email_normalized: string;

  @Column('varchar', { length: 100, nullable: true })
  first_name: string | null;

  @Column('varchar', { length: 100, nullable: true })
  last_name: string | null;

  @Column('varchar', { length: 20, nullable: true })
  phone: string | null;

  // ============================================================================
  // Account Status
  // ============================================================================

  @Column('varchar', { length: 20, nullable: false, default: 'active' })
  status: 'active' | 'inactive' | 'banned';

  // ============================================================================
  // Email Verification
  // ============================================================================

  @Column('boolean', { nullable: false, default: false })
  email_verified: boolean;

  @Column('timestamptz', { nullable: true })
  email_verified_at: Date | null;

  // ============================================================================
  // Audit & Lifecycle
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at: Date | null;

  // ============================================================================
  // Relationships (lazy loaded)
  // ============================================================================

  // customer_addresses - one-to-many
  addresses?: any[];

  // customer_preferences - one-to-one
  preferences?: any;

  // customer_consents - one-to-many
  consents?: any[];

  // customer_credentials - one-to-one
  credentials?: any;

  // sessions - one-to-many
  sessions?: any[];
}
