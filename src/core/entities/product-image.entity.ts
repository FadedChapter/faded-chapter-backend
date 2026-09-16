/**
 * Product Image Entity
 * Product images with ordering support
 *
 * Phase 4: Catalog Domain
 */

import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Relation } from 'typeorm';
import { ProductEntity } from './product.entity.js';

@Entity('product_images')
export class ProductImageEntity {
  @PrimaryColumn('uuid')
  id: string;

  @PrimaryColumn('uuid')
  product_id: string;

  @PrimaryColumn('uuid')
  store_id: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'product_id', referencedColumnName: 'id' },
    { name: 'store_id', referencedColumnName: 'store_id' },
  ])
  /** Relation<T> breaks the ESM circular-import metadata cycle — see cart.entity.ts. */
  product: Relation<ProductEntity>;

  @Column('varchar', { length: 500 })
  url: string;

  @Column('varchar', { length: 255, nullable: true })
  alt_text: string;

  @Column('integer', { default: 0 })
  display_order: number;

  @Column('boolean', { default: false })
  is_primary: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at: Date;
}
