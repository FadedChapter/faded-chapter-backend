/**
 * Store Entity
 * Root business boundary. One instance = Faded Chapter (today).
 * Foundation for multi-store/multi-tenant (future).
 *
 * Core Domain v2.1: Table 1/11
 */

import {
  Entity,
  PrimaryColumn,
  Generated,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';

@Entity('stores')
export class StoreEntity {
  // ============================================================================
  // Identity
  // ============================================================================

  @PrimaryColumn('uuid')
  @Generated('uuid')
  id: string;

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @Column('varchar', { length: 100, nullable: false, unique: false })
  slug: string;

  @Column('varchar', { length: 255, nullable: true, unique: false })
  domain: string | null;

  // ============================================================================
  // Contact
  // ============================================================================

  @Column('varchar', { length: 255, nullable: false })
  owner_email: string;

  @Column('varchar', { length: 255, nullable: true })
  owner_name: string | null;

  // ============================================================================
  // Status
  // ============================================================================

  @Column('varchar', { length: 20, nullable: false, default: 'active' })
  status: 'active' | 'suspended' | 'closed';

  // ============================================================================
  // Audit
  // ============================================================================

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // ============================================================================
  // Relationships (lazy loaded)
  // ============================================================================

  // store_settings - one-to-one
  store_settings?: any;

  // customers - one-to-many
  customers?: any[];
}
