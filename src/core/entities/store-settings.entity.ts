/**
 * Store Settings Entity
 * Store operational configuration, separate from identity.
 *
 * Core Domain v2.1: Table 2/11
 *
 * Rewritten during schema reconciliation to match the table that actually
 * exists and is read by the admin Settings module.
 *
 * The previous shape declared a much larger table — default_currency,
 * default_locale, guest_checkout_enabled, maintenance_mode, settings_json and
 * more — none of which was implemented or referenced anywhere. It also carried
 * a surrogate `id` alongside a unique `store_id`, which permits two settings
 * rows per store for a relationship that is 1:1; store_id is the primary key
 * here instead.
 *
 * Columns are added back when a feature needs them, not in advance.
 */

import { Entity, PrimaryColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { StoreEntity } from './store.entity.js';

@Entity('store_settings')
export class StoreSettingsEntity {
  /** Settings are 1:1 with a store, so the store is the identity. */
  @PrimaryColumn('uuid')
  store_id: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: StoreEntity;

  /** ISO 4217, validated against the runtime's currency list on write. */
  @Column('varchar', { length: 3, nullable: false, default: 'INR' })
  currency: string;

  /** IANA timezone name, validated on write. */
  @Column('varchar', { length: 64, nullable: false, default: 'Asia/Kolkata' })
  timezone: string;

  /** Contact shown to customers. Nullable: a store may not publish one. */
  @Column('varchar', { length: 255, nullable: true })
  support_email: string | null;

  @Column('varchar', { length: 40, nullable: true })
  support_phone: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
