/**
 * Cart Line Entity
 * Items in a shopping cart
 *
 * Phase 6: Cart & Checkout Domain
 */

import { Entity, Column, ManyToOne, JoinColumn, Index, Relation } from 'typeorm';
import { CartEntity } from './cart.entity.js';

@Entity('cart_lines')
@Index(['cart_id', 'store_id'])
@Index(['store_id', 'product_variant_id'])
export class CartLineEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  cart_id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('uuid')
  product_variant_id: string;

  @Column('uuid')
  product_id: string;

  @Column('integer')
  quantity: number;

  @Column('numeric', { precision: 10, scale: 2 })
  unit_price: number;

  @Column('numeric', { precision: 10, scale: 2 })
  line_total: number;

  @Column('varchar', { length: 100 })
  sku: string;

  @Column('varchar', { length: 255 })
  product_name: string;

  @Column('varchar', { length: 255, nullable: true })
  variant_name?: string;

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => CartEntity, (cart) => cart.lines, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'cart_id', referencedColumnName: 'id' },
    { name: 'store_id', referencedColumnName: 'store_id' },
  ])
  /** Relation<T> breaks the ESM circular-import metadata cycle — see cart.entity.ts. */
  cart: Relation<CartEntity>;
}
