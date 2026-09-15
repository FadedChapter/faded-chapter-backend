/**
 * Migration: Create Stores Table
 * Root boundary for multi-tenancy
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateStoresTable1726350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'stores',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'domain',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'owner_email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'owner_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'NOW()',
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'stores',
      new TableIndex({
        columnNames: ['slug'],
        name: 'idx_stores_slug',
      })
    );

    await queryRunner.createIndex(
      'stores',
      new TableIndex({
        columnNames: ['domain'],
        name: 'idx_stores_domain',
      })
    );

    await queryRunner.createIndex(
      'stores',
      new TableIndex({
        columnNames: ['status'],
        name: 'idx_stores_status',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('stores');
  }
}
