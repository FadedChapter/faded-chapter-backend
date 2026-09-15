/**
 * Migration: Create Sessions Table
 * Multi-device session management with token hashing
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSessionsTable1726350007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
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
            name: 'ip_address',
            type: 'inet',
            isNullable: false,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'device_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'device_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'NOW()',
          },
          {
            name: 'last_activity_at',
            type: 'timestamptz',
            default: 'NOW()',
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'revoked_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Add composite FK
    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
        name: 'fk_sessions_customer',
      })
    );

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        columnNames: ['customer_id', 'store_id'],
        name: 'idx_sessions_customer',
      })
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        columnNames: ['token_hash'],
        name: 'idx_sessions_token_hash',
      })
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        columnNames: ['customer_id', 'store_id', 'is_active'],
        name: 'idx_sessions_active',
      })
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        columnNames: ['expires_at'],
        name: 'idx_sessions_expires_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sessions');
  }
}
