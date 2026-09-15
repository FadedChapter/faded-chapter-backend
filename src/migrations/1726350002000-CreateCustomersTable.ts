/**
 * Migration: Create Customers Table
 * Customer identity with composite PK (id, store_id) for multi-tenancy
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCustomersTable1726350002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'customers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'store_id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'email_normalized',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'email_verified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'email_verified_at',
            type: 'timestamptz',
            isNullable: true,
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
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'customers',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_customers_store_id',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'customers',
      new TableIndex({
        columnNames: ['store_id'],
        name: 'idx_customers_store_id',
      })
    );

    await queryRunner.createIndex(
      'customers',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_customers_store_status',
      })
    );

    await queryRunner.createIndex(
      'customers',
      new TableIndex({
        columnNames: ['created_at'],
        name: 'idx_customers_created_at',
      })
    );

    // Unique constraint on email_normalized per store (where deleted_at IS NULL)
    await queryRunner.createIndex(
      'customers',
      new TableIndex({
        columnNames: ['store_id', 'email_normalized'],
        where: 'deleted_at IS NULL',
        isUnique: true,
        name: 'idx_customers_email_normalized_active',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('customers');
  }
}
