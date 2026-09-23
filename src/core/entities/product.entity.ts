/**
 * Product Entity
 * Core product definition with multi-tenant store isolation
 *
 * Phase 4: Catalog Domain
 */

import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { StoreEntity } from './store.entity.js';

@Entity('products')
export class ProductEntity {
  @PrimaryColumn('uuid')
  id: string;

  @PrimaryColumn('uuid')
  store_id: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id', referencedColumnName: 'id' })
  store: StoreEntity;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 255, unique: false }) // Unique per store via constraint
  slug: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('varchar', { length: 100, nullable: true })
  sku: string | null;

  @Column('varchar', { length: 50, default: 'active' })
  status: string; // active, draft, archived, discontinued

  @Column('boolean', { default: false })
  is_featured: boolean;

  @Column('integer', { default: 0 })
  display_order: number;

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>; // Custom fields

  @Column('uuid', { nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at: Date;

  // Category assignment.
  // Previously declared without a @Column decorator, so TypeORM never selected
  // or persisted it and any category assignment silently did nothing.
  @Column('uuid', { nullable: true })
  category_id?: string;

  // Relationships (lazy loaded)
  variants?: ProductVariantEntity[];
  images?: ProductImageEntity[];
}

import { ProductVariantEntity } from './product-variant.entity.js';
import { ProductImageEntity } from './product-image.entity.js';
