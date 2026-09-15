/**
 * Password Reset Entity
 * TypeORM entity for tracking password reset tokens
 * Phase 3F.5: Password reset system
 */

import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('password_resets')
@Index('idx_password_user_id', ['userId'])
@Index('idx_password_token', ['token'])
export class PasswordResetEntity {
  @PrimaryColumn('varchar')
  id!: string; // Reset record ID

  @Column('varchar')
  userId!: string; // User requesting password reset

  @Column('varchar', { unique: true })
  token!: string; // One-time reset token

  @Column('varchar')
  email!: string; // Email requesting reset

  @Column('datetime')
  expiresAt!: Date; // Token expiry (24 hours)

  @Column('datetime', { nullable: true })
  usedAt?: Date; // When password was reset

  @Column('boolean', { default: false })
  isUsed!: boolean; // Whether token was already used

  @Column('integer', { default: 1 })
  attemptCount!: number; // How many times password change attempted

  @Column('datetime', { nullable: true })
  requestedAt?: Date; // When reset was requested

  @Column('varchar', { nullable: true })
  ipAddress?: string; // IP that requested reset (audit trail)

  @Column('varchar', { nullable: true })
  userAgent?: string; // Browser that requested reset (audit trail)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
