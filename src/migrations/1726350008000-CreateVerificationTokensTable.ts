/**
 * Migration: Create Verification Tokens Table
 * Email verification tokens (ephemeral, 24h expiry)
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateVerificationTokensTable1726350008000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'verification_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'token_hash',
            type: 'varchar',
            length: '64',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'purpose',
            type: 'varchar',
            length: '50',
            default: "'email_verification'",
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'consumed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'NOW()',
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Add composite FK
    await queryRunner.createForeignKey(
      'verification_tokens',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
        name: 'fk_verification_tokens_customer',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'verification_tokens',
      new TableIndex({
        columnNames: ['token_hash'],
        name: 'idx_verification_tokens_hash',
      })
    );

    await queryRunner.createIndex(
      'verification_tokens',
      new TableIndex({
        columnNames: ['customer_id', 'store_id'],
        name: 'idx_verification_tokens_customer',
      })
    );

    await queryRunner.createIndex(
      'verification_tokens',
      new TableIndex({
        columnNames: ['expires_at'],
        name: 'idx_verification_tokens_expires_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('verification_tokens');
  }
}
