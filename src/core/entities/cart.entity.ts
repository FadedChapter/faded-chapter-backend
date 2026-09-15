/**
 * Cart Entity
 * Shopping cart with line items and pricing
 *
 * Phase 6: Cart & Checkout Domain
 */

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';
import { CartLineEntity } from './cart-line.entity.js';

@Entity('carts')
@Index(['store_id', 'customer_id'], { unique: true })
@Index(['store_id', 'status'])
@Index(['store_id', 'created_at'])
export class CartEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('uuid')
  customer_id: string;

  @Column('varchar', { length: 50, default: 'active' })
  status: 'active' | 'abandoned' | 'converted';

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  tax_estimate: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  shipping_estimate: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  total_estimate: number;

  @Column('jsonb', { default: '[]' })
  coupon_codes: string[];

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @Column('boolean', { default: false })
  abandoned_email_sent: boolean;

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  @Column('timestamptz', { nullable: true })
  converted_at?: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'store_id', referencedColumnName: 'id' },
  ])
  store: StoreEntity;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'id' })
  customer: CustomerEntity;

  @OneToMany(() => CartLineEntity, (line) => line.cart, { cascade: ['remove'] })
  lines: CartLineEntity[];
}
