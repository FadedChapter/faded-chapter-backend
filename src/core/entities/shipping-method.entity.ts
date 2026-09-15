/**
 * Shipping Method Entity
 * Available shipping methods (Standard, Express, Overnight, etc.)
 *
 * Phase 8: Shipping Integration
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';

@Entity('shipping_methods')
@Index(['store_id', 'active'])
export class ShippingMethodEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('varchar', { length: 100 })
  name: string; // e.g., "Standard Ground", "Express", "Overnight"

  @Column('text', { nullable: true })
  description?: string; // e.g., "5-7 business days"

  @Column('varchar', { length: 50 })
  type: 'ground' | 'express' | 'overnight' | 'international' | 'local'; // Shipping type

  @Column('numeric', { precision: 10, scale: 2 })
  base_cost: number; // Base cost for this method (e.g., 5.99)

  @Column('integer')
  est_days_min: number; // Minimum estimated delivery days

  @Column('integer')
  est_days_max: number; // Maximum estimated delivery days

  @Column('boolean', { default: true })
  active: boolean; // Whether this method is available for selection

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>; // Carrier code, service code, rate type, etc.
  // Example: { carrier: 'fedex', service_code: 'FEDEX_GROUND', rate_type: 'weight_based' }

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'store_id', referencedColumnName: 'id' }])
  store: StoreEntity;
}
