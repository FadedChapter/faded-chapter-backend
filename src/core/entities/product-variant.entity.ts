/**
 * Product Variant Entity
 * Product variants (size, color, style combinations)
 *
 * Phase 4: Catalog Domain
 */

import { Entity, PrimaryColumn,
  Generated, Column, ManyToOne, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Relation } from 'typeorm';
import { ProductEntity } from './product.entity.js';
import { InventoryEntity } from './inventory.entity.js';

@Entity('product_variants')
export class ProductVariantEntity {
  @PrimaryColumn('uuid')
  @Generated('uuid')
  id: string;

  @PrimaryColumn('uuid')
  @Generated('uuid')
  product_id: string;

  @PrimaryColumn('uuid')
  @Generated('uuid')
  store_id: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'product_id', referencedColumnName: 'id' },
    { name: 'store_id', referencedColumnName: 'store_id' },
  ])
  /** Relation<T> breaks the ESM circular-import metadata cycle — see cart.entity.ts. */
  product: Relation<ProductEntity>;

  @Column('varchar', { length: 100 })
  sku: string; // SKU must be unique per store

  @Column('varchar', { length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('numeric', { precision: 10, scale: 2 })
  price: number;

  @Column('numeric', { precision: 10, scale: 2, nullable: true })
  cost: number;

  @Column('numeric', { precision: 10, scale: 3, nullable: true })
  weight: number; // kg

  @Column('jsonb', { default: '{}' })
  attributes: Record<string, string>; // size, color, style, etc.

  @Column('varchar', { length: 50, default: 'active' })
  status: string; // active, discontinued

  @Column('integer', { default: 0 })
  display_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at: Date;

  // Relationships
  inventory?: InventoryEntity;
}
