/**
 * Store Settings Entity
 * Store operational configuration, separate from identity.
 *
 * Core Domain v2.1: Table 2/11
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StoreEntity } from './store.entity.js';

@Entity('store_settings')
export class StoreSettingsEntity {
  // ============================================================================
  // Identity
  // ============================================================================

  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { nullable: false, unique: true })
  store_id: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: StoreEntity;

  // ============================================================================
  // Default Operational Settings
  // ============================================================================

  @Column('varchar', { length: 3, nullable: false, default: 'INR' })
  default_currency: string;

  @Column('varchar', { length: 50, nullable: false, default: 'Asia/Kolkata' })
  default_timezone: string;

  @Column('varchar', { length: 10, nullable: false, default: 'en-IN' })
  default_locale: string;

  // ============================================================================
  // Features
  // ============================================================================

  @Column('boolean', { nullable: false, default: true })
  guest_checkout_enabled: boolean;

  @Column('boolean', { nullable: false, default: true })
  customer_accounts_enabled: boolean;

  @Column('boolean', { nullable: false, default: true })
  email_verification_required: boolean;

  // ============================================================================
  // Ordering
  // ============================================================================

  @Column('varchar', { length: 10, nullable: true, default: '' })
  order_number_prefix: string;

  @Column('integer', { nullable: true, default: 1001 })
  order_number_start: number;

  // ============================================================================
  // Inventory
  // ============================================================================

  @Column('boolean', { nullable: false, default: true })
  inventory_enabled: boolean;

  @Column('boolean', { nullable: false, default: true })
  track_inventory: boolean;

  // ============================================================================
  // Tax
  // ============================================================================

  @Column('boolean', { nullable: false, default: true })
  tax_enabled: boolean;

  // ============================================================================
  // Maintenance
  // ============================================================================

  @Column('boolean', { nullable: false, default: false })
  maintenance_mode: boolean;

  @Column('text', { nullable: true })
  maintenance_message: string | null;

  // ============================================================================
  // Extension
  // ============================================================================

  @Column('jsonb', { nullable: true, default: '{}' })
  settings_json: Record<string, any>;

  // ============================================================================
  // Audit
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
