/**
 * Payment Entity
 * Represents payment attempts and their lifecycle
 *
 * Phase 9: Payment Processing
 */

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';
import { OrderEntity } from './order.entity.js';

@Entity('payments')
@Index(['store_id', 'order_id'])
@Index(['store_id', 'customer_id'])
@Index(['store_id', 'status'])
@Index(['store_id', 'razorpay_payment_id'])
@Index(['store_id', 'razorpay_order_id'])
@Index(['store_id', 'created_at'])
export class PaymentEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid', { primary: true })
  store_id: string;

  @Column('uuid')
  customer_id: string;

  @Column('uuid', { nullable: true })
  order_id?: string; // Nullable for pre-checkout payments

  @Column('varchar', { length: 255, nullable: true })
  razorpay_payment_id?: string; // Razorpay Payment ID

  @Column('varchar', { length: 255, nullable: true })
  razorpay_order_id?: string; // Razorpay Order ID

  @Column('numeric', { precision: 10, scale: 2 })
  amount: number; // Payment amount

  @Column('varchar', { length: 3, default: 'INR' })
  currency: string; // ISO 4217 code (INR, USD, GBP, etc.)

  @Column('varchar', { length: 50, default: 'pending' })
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded';

  @Column('varchar', { length: 50, default: 'razorpay' })
  payment_method: 'razorpay'; // Always razorpay for now

  @Column('varchar', { length: 50, nullable: true })
  payment_method_type?: string; // card|netbanking|wallet|upi|emandate

  @Column('varchar', { length: 4, nullable: true })
  last_four?: string; // Last 4 digits of card/account

  @Column('varchar', { length: 50, nullable: true })
  card_brand?: string; // visa, mastercard, amex, etc.

  @Column('varchar', { length: 100, nullable: true })
  error_code?: string; // Error code if failed

  @Column('text', { nullable: true })
  error_message?: string; // Error message if failed

  @Column('varchar', { length: 50, nullable: true })
  risk_rating?: string; // low|medium|high|critical

  @Column('text', { nullable: true })
  risk_reason?: string; // Reason for risk rating

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>; // Razorpay metadata, webhook_id, etc.

  @Column('timestamptz', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'store_id', referencedColumnName: 'id' }])
  store: StoreEntity;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([{ name: 'customer_id', referencedColumnName: 'id' }])
  customer: CustomerEntity;

  @ManyToOne(() => OrderEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn([{ name: 'order_id', referencedColumnName: 'id' }])
  order?: OrderEntity;
}
