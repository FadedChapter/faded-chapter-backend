/**
 * Promo Code Entity
 * Promotional codes and discount rules
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';

@Entity('promo_codes')
@Index(['store_id', 'code'], { unique: true })
@Index(['store_id', 'status'])
@Index(['store_id', 'start_date'])
@Index(['store_id', 'end_date'])
export class PromoCodeEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('varchar', { length: 100 })
  code: string; // e.g., "SAVE20", "SUMMER2024"

  @Column('varchar', { length: 50 })
  discount_type: 'percentage' | 'fixed' | 'free_shipping' | 'bogo' | 'tiered';

  @Column('numeric', { precision: 10, scale: 2 })
  discount_value: number; // 20 for 20%, 10 for $10 off

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 50, default: 'active' })
  status: 'active' | 'inactive' | 'expired';

  @Column('integer', { nullable: true })
  usage_limit?: number; // max uses, null = unlimited

  @Column('integer', { default: 0 })
  usage_count: number; // current uses

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  min_purchase: number; // minimum cart total required

  @Column('numeric', { precision: 10, scale: 2, nullable: true })
  max_discount?: number; // cap on discount amount

  @Column('jsonb', { default: 'null' })
  applicable_products?: string[]; // null = all products

  @Column('jsonb', { default: 'null' })
  applicable_categories?: string[]; // null = all categories

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>; // marketing campaign, source, etc.

  @Column('timestamptz')
  start_date: Date;

  @Column('timestamptz', { nullable: true })
  end_date?: Date;

  @Column('boolean', { default: true })
  stackable: boolean; // can combine with other coupons

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'store_id', referencedColumnName: 'id' },
  ])
  store: StoreEntity;
}
