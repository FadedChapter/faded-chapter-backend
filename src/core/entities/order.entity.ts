/**
 * Order Entity
 * Represents a customer order with pricing and status tracking
 *
 * Phase 5: Order Management Domain
 */

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';
import { OrderLineEntity } from './order-line.entity.js';

@Entity('orders')
@Index(['store_id', 'customer_id'])
@Index(['store_id', 'status'])
@Index(['store_id', 'payment_status'])
@Index(['store_id', 'fulfillment_status'])
@Index(['store_id', 'created_at'])
@Index(['store_id', 'order_number'], { unique: true })
export class OrderEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('uuid')
  customer_id: string;

  @Column('varchar', { length: 50 })
  order_number: string; // e.g., "ORD-00001" (unique per store)

  @Column('varchar', { length: 50, default: 'pending' })
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

  @Column('varchar', { length: 50, default: 'unpaid' })
  payment_status: 'unpaid' | 'paid' | 'refunded' | 'partially_refunded';

  @Column('varchar', { length: 50, default: 'unfulfilled' })
  fulfillment_status: 'unfulfilled' | 'partially_fulfilled' | 'fulfilled';

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  tax_amount: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  shipping_amount: number;

  @Column('numeric', { precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column('numeric', { precision: 10, scale: 2 })
  total: number;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('text', { nullable: true })
  customer_notes?: string;

  @Column('varchar', { length: 100, nullable: true })
  payment_method?: string;

  @Column('jsonb', { default: '{}' })
  shipping_address: Record<string, any>;

  @Column('jsonb', { default: '{}' })
  billing_address: Record<string, any>;

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  @Column('timestamptz', { nullable: true })
  cancelled_at?: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'store_id', referencedColumnName: 'id' },
  ])
  store: StoreEntity;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'id' })
  customer: CustomerEntity;

  @OneToMany(() => OrderLineEntity, (line) => line.order, { cascade: ['soft-remove'] })
  lines: OrderLineEntity[];
}
