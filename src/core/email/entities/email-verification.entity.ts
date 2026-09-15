/**
 * Email Verification Entity
 * TypeORM entity for tracking email verification tokens
 * Phase 3F.4: Email verification system
 */

import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('email_verifications')
@Index('idx_email_user_id', ['userId'])
@Index('idx_email_token', ['token'])
export class EmailVerificationEntity {
  @PrimaryColumn('varchar')
  id!: string; // Verification record ID

  @Column('varchar')
  userId!: string; // User who needs to verify email

  @Column('varchar', { unique: true })
  token!: string; // One-time verification token

  @Column('varchar')
  email!: string; // Email being verified

  @Column('datetime')
  expiresAt!: Date; // Token expiry (24 hours)

  @Column('datetime', { nullable: true })
  verifiedAt?: Date; // When email was verified

  @Column('boolean', { default: false })
  isUsed!: boolean; // Whether token was already used

  @Column('integer', { default: 0 })
  attemptCount!: number; // Resend attempt count

  @Column('datetime', { nullable: true })
  lastSentAt?: Date; // When verification email was last sent

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
