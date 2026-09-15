/**
 * Migration: Create Carts Table
 * Shopping carts for customers
 *
 * Phase 6: Cart & Checkout
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCartsTable1726350018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'carts',
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
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'subtotal',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'tax_estimate',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'shipping_estimate',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'discount_amount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'total_estimate',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'coupon_codes',
            type: 'jsonb',
            default: `'[]'::jsonb`,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'abandoned_email_sent',
            type: 'boolean',
            default: false,
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
            name: 'converted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Add composite FK to stores
    await queryRunner.createForeignKey(
      'carts',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_carts_store',
      })
    );

    // Add FK to customers (composite: customer_id + store_id)
    await queryRunner.createForeignKey(
      'carts',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'RESTRICT',
        name: 'fk_carts_customer',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'carts',
      new TableIndex({
        columnNames: ['store_id', 'customer_id'],
        isUnique: true,
        name: 'idx_carts_customer_unique',
      })
    );

    await queryRunner.createIndex(
      'carts',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_carts_status',
      })
    );

    await queryRunner.createIndex(
      'carts',
      new TableIndex({
        columnNames: ['store_id', 'created_at'],
        name: 'idx_carts_created_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('carts');
  }
}
