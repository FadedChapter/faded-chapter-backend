/**
 * Session Entity
 * TypeORM entity for Session table
 * Phase 3F.1: Session management
 */

import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn('varchar')
  id!: string; // Session token (opaque ID)

  @Column('varchar', { nullable: true })
  userId?: string; // Customer/User ID

  @Column('varchar', { nullable: true })
  email?: string; // Email for audit trail

  @Column('datetime')
  expiresAt!: Date; // Absolute timeout

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date; // Updated on refresh for idle tracking
}
