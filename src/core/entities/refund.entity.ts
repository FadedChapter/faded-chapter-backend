/**
 * Refund Entity
 * Represents refunds and their lifecycle with manual approval
 *
 * Phase 9: Payment Processing
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { PaymentEntity } from './payment.entity.js';
import { OrderEntity } from './order.entity.js';

@Entity('refunds')
@Index(['store_id', 'payment_id'])
@Index(['store_id', 'order_id'])
@Index(['store_id', 'status'])
@Index(['store_id', 'created_at'])
export class RefundEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('uuid')
  payment_id: string; // FK to Payment

  @Column('uuid')
  order_id: string; // FK to Order

  @Column('varchar', { length: 255, nullable: true })
  razorpay_refund_id?: string; // Razorpay Refund ID (set after approval)

  @Column('numeric', { precision: 10, scale: 2 })
  amount: number; // Refund amount

  @Column('varchar', { length: 100 })
  reason: string; // requested_by_customer|fraudulent|duplicate|general|other

  @Column('varchar', { length: 50, default: 'pending_approval' })
  status: 'pending_approval' | 'approved' | 'rejected' | 'succeeded' | 'failed';

  @Column('uuid', { nullable: true })
  approved_by?: string; // Admin user who approved (nullable)

  @Column('timestamptz', { nullable: true })
  approval_date?: Date; // When refund was approved

  @Column('text', { nullable: true })
  approval_notes?: string; // Admin notes on approval/rejection

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>; // Reason details, webhook data, etc.

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'store_id', referencedColumnName: 'id' }])
  store: StoreEntity;

  @ManyToOne(() => PaymentEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'payment_id', referencedColumnName: 'id' }])
  payment: PaymentEntity;

  @ManyToOne(() => OrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'order_id', referencedColumnName: 'id' }])
  order: OrderEntity;
}
