/**
 * User Entity
 * TypeORM entity for User table
 * Phase 3F.2: Database migration from in-memory store
 */

import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { unique: true })
  email!: string;

  @Column('varchar')
  passwordHash!: string;

  @Column('varchar')
  firstName!: string;

  @Column('varchar')
  lastName!: string;

  @Column('boolean', { default: false })
  emailVerified!: boolean;

  @Column('datetime', { nullable: true })
  emailVerifiedAt?: Date; // When email was verified

  @Column('boolean', { nullable: true })
  marketingOptIn?: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
