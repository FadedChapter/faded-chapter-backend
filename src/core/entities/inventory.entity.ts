/**
 * Inventory Entity
 * Stock tracking and reservations
 *
 * Phase 4: Catalog Domain
 */

import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProductVariantEntity } from './product-variant.entity.js';

@Entity('inventory')
export class InventoryEntity {
  @PrimaryColumn('uuid')
  id: string;

  @PrimaryColumn('uuid')
  variant_id: string;

  @PrimaryColumn('uuid')
  store_id: string;

  @OneToOne(() => ProductVariantEntity, (variant) => variant.inventory, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'variant_id', referencedColumnName: 'id' },
    { name: 'store_id', referencedColumnName: 'store_id' },
  ])
  variant: ProductVariantEntity;

  @Column('integer', { default: 0 })
  quantity_available: number;

  @Column('integer', { default: 0 })
  quantity_reserved: number;

  @Column('integer', { default: 0 })
  reorder_level: number;

  @Column('integer', { default: 0 })
  reorder_quantity: number;

  @Column('timestamptz', { nullable: true })
  last_counted_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Computed
  get quantity_total(): number {
    return this.quantity_available + this.quantity_reserved;
  }

  get is_low_stock(): boolean {
    return this.quantity_available <= this.reorder_level;
  }
}
