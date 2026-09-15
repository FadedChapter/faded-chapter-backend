/**
 * Order Entity
 * TypeORM entity for storing Shopify orders locally
 * Phase 3F.6: Order Management
 */

import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type FulfillmentStatus = 'unfulled' | 'partial' | 'fulfilled' | 'restocked';

export interface OrderLineItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
  sku?: string;
  image_url?: string;
}

@Entity('orders')
@Index('idx_order_user_id', ['userId'])
@Index('idx_order_shopify_id', ['shopifyOrderId'])
@Index('idx_order_status', ['status'])
@Index('idx_order_created', ['createdAt'])
export class OrderEntity {
  @PrimaryColumn('varchar')
  id!: string; // Our internal order ID (UUID)

  @Column('varchar')
  userId!: string; // User who made the order

  @Column('varchar', { unique: true })
  shopifyOrderId!: string; // Shopify's order ID

  @Column('varchar')
  orderNumber!: string; // Human-readable order number (e.g., #1001)

  @Column('varchar', { default: 'pending' })
  status!: OrderStatus; // Order status

  @Column('varchar', { default: 'pending' })
  paymentStatus!: PaymentStatus; // Payment status

  @Column('varchar', { default: 'unfulfilled' })
  fulfillmentStatus!: FulfillmentStatus; // Fulfillment status

  @Column('simple-json')
  lineItems!: OrderLineItem[]; // Items in the order

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal!: number; // Total before tax/shipping

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tax!: number; // Tax amount

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  shipping!: number; // Shipping cost

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount!: number; // Discount applied

  @Column('decimal', { precision: 10, scale: 2 })
  total!: number; // Final total (subtotal + tax + shipping - discount)

  @Column('varchar', { nullable: true })
  currency!: string; // Currency code (USD, EUR, etc.)

  @Column('simple-json', { nullable: true })
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };

  @Column('simple-json', { nullable: true })
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };

  @Column('varchar', { nullable: true })
  email!: string; // Customer email

  @Column('varchar', { nullable: true })
  phone?: string; // Customer phone

  @Column('datetime', { nullable: true })
  processedAt?: Date; // When order was confirmed

  @Column('datetime', { nullable: true })
  shippedAt?: Date; // When order was shipped

  @Column('datetime', { nullable: true })
  deliveredAt?: Date; // When order was delivered

  @Column('datetime', { nullable: true })
  cancelledAt?: Date; // When order was cancelled

  @Column('varchar', { nullable: true })
  trackingNumber?: string; // Shipping tracking number

  @Column('varchar', { nullable: true })
  carrier?: string; // Shipping carrier (FedEx, UPS, etc.)

  @Column('text', { nullable: true })
  notes?: string; // Internal notes about order

  @Column('simple-json', { nullable: true })
  metadata?: Record<string, any>; // Additional metadata from Shopify

  @Column('datetime')
  syncedAt!: Date; // Last time synced from Shopify

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
