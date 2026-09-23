/**
 * Category Entity
 * Product categories with hierarchical support
 *
 * Phase 4: Catalog Domain
 */

import { Entity, PrimaryColumn,
  Generated, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { StoreEntity } from './store.entity.js';

@Entity('categories')
export class CategoryEntity {
  @PrimaryColumn('uuid')
  @Generated('uuid')
  id: string;

  @PrimaryColumn('uuid')
  @Generated('uuid')
  store_id: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id', referencedColumnName: 'id' })
  store: StoreEntity;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 255 })
  slug: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('uuid', { nullable: true })
  parent_category_id: string | null;

  @Column('integer', { default: 0 })
  display_order: number;

  @Column('boolean', { default: true })
  is_active: boolean;

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column('timestamptz', { nullable: true })
  deleted_at: Date;

  // Relationships
  parent?: CategoryEntity;
  children?: CategoryEntity[];
}
