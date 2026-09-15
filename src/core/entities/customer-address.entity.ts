/**
 * Customer Address Entity
 * Reusable mutable addresses. Customer can update at any time.
 *
 * Core Domain v2.1: Table 4/11
 * Composite FK: (customer_id, store_id) → customers(id, store_id)
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { StoreEntity } from './store.entity.js';
import { CustomerEntity } from './customer.entity.js';

@Entity('customer_addresses')
@Index('idx_customer_addresses_store_id', ['store_id'])
@Index('idx_customer_addresses_customer_id', ['customer_id'])
@Index('uq_customer_default_shipping', ['customer_id'], {
  unique: true,
  where: 'is_default_shipping = true'
})
@Index('uq_customer_default_billing', ['customer_id'], {
  unique: true,
  where: 'is_default_billing = true'
})
export class CustomerAddressEntity {
  // ============================================================================
  // Identity
  // ============================================================================

  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { nullable: false })
  store_id: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: StoreEntity;

  @Column('uuid', { nullable: false })
  customer_id: string;

  @ManyToOne(() => CustomerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity;

  // Composite FK enforced in migration

  // ============================================================================
  // Address Type
  // ============================================================================

  @Column('varchar', { length: 20, nullable: false, default: 'shipping' })
  type: 'shipping' | 'billing';

  // ============================================================================
  // Contact
  // ============================================================================

  @Column('varchar', { length: 100, nullable: false })
  first_name: string;

  @Column('varchar', { length: 100, nullable: false })
  last_name: string;

  @Column('varchar', { length: 20, nullable: true })
  phone: string | null;

  // ============================================================================
  // Address
  // ============================================================================

  @Column('varchar', { length: 255, nullable: false })
  address_line_1: string;

  @Column('varchar', { length: 255, nullable: true })
  address_line_2: string | null;

  @Column('varchar', { length: 100, nullable: false })
  city: string;

  @Column('varchar', { length: 100, nullable: true })
  state_province: string | null;

  @Column('varchar', { length: 20, nullable: true })
  postal_code: string | null;

  @Column('varchar', { length: 2, nullable: false })
  country_code: string;

  // ============================================================================
  // Flags
  // ============================================================================

  @Column('boolean', { nullable: false, default: false })
  is_default_shipping: boolean;

  @Column('boolean', { nullable: false, default: false })
  is_default_billing: boolean;

  @Column('varchar', { length: 100, nullable: true })
  label: string | null;

  // ============================================================================
  // Audit
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
