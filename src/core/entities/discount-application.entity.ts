/**
 * Discount Application Entity
 * Tracks discount applications to carts and orders
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { PromoCodeEntity } from './promo-code.entity.js';

@Entity('discount_applications')
@Index(['store_id', 'cart_id'])
@Index(['store_id', 'order_id'])
@Index(['store_id', 'promo_code_id'])
@Index(['store_id', 'created_at'])
export class DiscountApplicationEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('uuid')
  promo_code_id: string;

  @Column('uuid', { nullable: true })
  cart_id?: string; // applied to cart, null after checkout

  @Column('uuid', { nullable: true })
  order_id?: string; // applied to order after checkout

  @Column('numeric', { precision: 10, scale: 2 })
  discount_amount: number; // actual discount given

  @Column('numeric', { precision: 5, scale: 2, nullable: true })
  discount_percentage?: number; // percentage applied (if applicable)

  @Column('varchar', { length: 50 })
  discount_type: 'percentage' | 'fixed' | 'free_shipping' | 'bogo' | 'tiered';

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>; // calculation details, applied items, etc.

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'store_id', referencedColumnName: 'id' },
  ])
  store: StoreEntity;

  @ManyToOne(() => PromoCodeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'promo_code_id', referencedColumnName: 'id' },
  ])
  promo_code: PromoCodeEntity;
}
