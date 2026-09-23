/**
 * Customer Preferences Entity
 * Customer settings: communication preferences, display preferences.
 *
 * Core Domain v2.1: Table 5/11
 * Composite FK: (customer_id, store_id) → customers(id, store_id)
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

@Entity('customer_preferences')
@Index('uq_customer_preferences_customer_id', ['customer_id'], { unique: true })
export class CustomerPreferencesEntity {
  // ============================================================================
  // Identity
  // ============================================================================

  @PrimaryColumn('uuid')
  @Generated('uuid')
  id: string;

  @Column('uuid', { nullable: false })
  store_id: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: StoreEntity;

  @Column('uuid', { nullable: false, unique: true })
  customer_id: string;

  @ManyToOne(() => CustomerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity;

  // Composite FK enforced in migration

  // ============================================================================
  // Communication Preferences
  // ============================================================================

  @Column('boolean', { nullable: false, default: true })
  email_order_confirmation: boolean;

  @Column('boolean', { nullable: false, default: true })
  email_order_updates: boolean;

  @Column('boolean', { nullable: false, default: false })
  email_promotions: boolean;

  @Column('boolean', { nullable: false, default: false })
  email_newsletter: boolean;

  @Column('boolean', { nullable: false, default: false })
  email_product_updates: boolean;

  @Column('boolean', { nullable: false, default: true })
  email_transactional: boolean;

  @Column('boolean', { nullable: false, default: false })
  sms_order_updates: boolean;

  @Column('boolean', { nullable: false, default: false })
  sms_marketing: boolean;

  // ============================================================================
  // Display Preferences
  // ============================================================================

  @Column('varchar', { length: 10, nullable: false, default: 'en' })
  language: string;

  @Column('varchar', { length: 50, nullable: false, default: 'Asia/Kolkata' })
  timezone: string;

  // ============================================================================
  // Shopping Behavior
  // ============================================================================

  @Column('boolean', { nullable: false, default: true })
  save_payment_method: boolean;

  @Column('boolean', { nullable: false, default: true })
  auto_apply_rewards: boolean;

  // ============================================================================
  // Extension
  // ============================================================================

  @Column('jsonb', { nullable: true, default: '{}' })
  custom_settings: Record<string, any>;

  // ============================================================================
  // Audit
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
