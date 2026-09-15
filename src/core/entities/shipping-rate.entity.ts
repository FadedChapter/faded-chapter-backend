/**
 * Shipping Rate Entity
 * Real shipping rates based on weight ranges, zones, and methods
 *
 * Phase 8: Shipping Integration
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { ShippingMethodEntity } from './shipping-method.entity.js';

@Entity('shipping_rates')
@Index(['store_id', 'method_id', 'active'])
@Index(['store_id', 'zone_code'])
@Index(['method_id', 'weight_min', 'weight_max'])
export class ShippingRateEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('uuid')
  method_id: string; // FK to ShippingMethodEntity

  @Column('numeric', { precision: 10, scale: 2 })
  weight_min: number; // Minimum weight (lbs or kg, stored as-is)

  @Column('numeric', { precision: 10, scale: 2 })
  weight_max: number; // Maximum weight (exclusive upper bound)

  @Column('varchar', { length: 50 })
  zone_code: string; // Zone identifier (e.g., "USA", "CANADA", "INT'L", "ZIP_10001")

  @Column('numeric', { precision: 10, scale: 2 })
  base_rate: number; // Base cost for this weight range + zone

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  rate_per_unit: number; // Additional cost per unit of weight (e.g., $0.50/lb)

  @Column('boolean', { default: true })
  active: boolean; // Whether this rate is currently available

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'store_id', referencedColumnName: 'id' }])
  store: StoreEntity;

  @ManyToOne(() => ShippingMethodEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'method_id', referencedColumnName: 'id' }])
  shippingMethod: ShippingMethodEntity;
}
