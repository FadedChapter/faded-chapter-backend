/**
 * Migration: Create Password Reset Tokens Table
 * Password reset with brute-force protection (3 max attempts)
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePasswordResetTokensTable1726350009000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
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
          {
            name: 'attempt_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'max_attempts',
            type: 'integer',
            default: 3,
          },
          {
            name: 'requested_ip_address',
            type: 'inet',
            isNullable: true,
          },
          {
            name: 'used_ip_address',
            type: 'inet',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Add composite FK
    await queryRunner.createForeignKey(
      'password_reset_tokens',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
        name: 'fk_password_reset_tokens_customer',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        columnNames: ['token_hash'],
        name: 'idx_password_reset_tokens_hash',
      })
    );

    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        columnNames: ['customer_id', 'store_id'],
        name: 'idx_password_reset_tokens_customer',
      })
    );

    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        columnNames: ['expires_at'],
        name: 'idx_password_reset_tokens_expires_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_reset_tokens');
  }
}
