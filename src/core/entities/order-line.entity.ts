/**
 * Order Line Entity
 * Represents a line item in an order
 *
 * Phase 5: Order Management Domain
 */

import { Entity, Column, ManyToOne, JoinColumn, Index, Relation } from 'typeorm';
import { OrderEntity } from './order.entity.js';

@Entity('order_lines')
@Index(['order_id', 'store_id'])
@Index(['store_id', 'product_variant_id'])
@Index(['store_id', 'fulfillment_status'])
export class OrderLineEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  order_id: string;

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

  @Column('varchar', { length: 50, default: 'unfulfilled' })
  fulfillment_status: 'unfulfilled' | 'fulfilled' | 'cancelled';

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => OrderEntity, (order) => order.lines, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'order_id', referencedColumnName: 'id' },
    { name: 'store_id', referencedColumnName: 'store_id' },
  ])
  /** Relation<T> breaks the ESM circular-import metadata cycle — see cart.entity.ts. */
  order: Relation<OrderEntity>;
}
