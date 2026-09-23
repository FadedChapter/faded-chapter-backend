/**
 * Customer Consent Entity
 * AUDIT HISTORY of legal/marketing consent. Immutable append-only.
 *
 * Core Domain v2.1: Table 6/11
 * Composite FK: (customer_id, store_id) → customers(id, store_id)
 *
 * Note: DB mutation protection via trigger (created in migration)
 * This table is append-only: no UPDATE or DELETE allowed
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

@Entity('customer_consents')
@Index('idx_customer_consents_customer_id', ['customer_id'])
@Index('idx_customer_consents_created_at', ['created_at'])
@Index('idx_customer_consents_lookup', ['store_id', 'customer_id', 'consent_type', 'created_at'])
export class CustomerConsentEntity {
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

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity;

  // Composite FK enforced in migration

  // ============================================================================
  // Consent Type
  // ============================================================================

  @Column('varchar', { length: 100, nullable: false })
  consent_type: string;
  // ENUM: marketing_email, marketing_sms, analytics, newsletter, terms_of_service

  // ============================================================================
  // State
  // ============================================================================

  @Column('boolean', { nullable: false })
  granted: boolean;

  // ============================================================================
  // Legal Metadata
  // ============================================================================

  @Column('varchar', { length: 50, nullable: true })
  policy_version: string | null;
  // e.g., "v1.0", "2024-01"

  @Column('varchar', { length: 512, nullable: true })
  policy_url: string | null;

  // ============================================================================
  // Context
  // ============================================================================

  @Column('varchar', { length: 50, nullable: false })
  source: string;
  // ENUM: signup, preference_page, email_link, api

  @Column('varchar', { length: 45, nullable: true })
  ip_address: string | null;

  @Column('text', { nullable: true })
  user_agent: string | null;

  // ============================================================================
  // Audit (immutable)
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // NOTE: NO UPDATE or DELETE allowed
  // Mutation protection enforced via PostgreSQL trigger
  // Trigger created in migration: prevent_customer_consent_mutation()
}
