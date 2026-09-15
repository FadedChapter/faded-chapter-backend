/**
 * Migration: Create Orders Table
 * Customer orders with pricing and status tracking
 *
 * Phase 5: Order Management
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateOrdersTable1726350016000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'orders',
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
            name: 'order_number',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'payment_status',
            type: 'varchar',
            length: '50',
            default: "'unpaid'",
          },
          {
            name: 'fulfillment_status',
            type: 'varchar',
            length: '50',
            default: "'unfulfilled'",
          },
          {
            name: 'subtotal',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'tax_amount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'shipping_amount',
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
            name: 'total',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'customer_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'shipping_address',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'billing_address',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
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
            name: 'cancelled_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Add composite FK to stores
    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_orders_store',
      })
    );

    // Add FK to customers (composite: customer_id + store_id)
    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'RESTRICT',
        name: 'fk_orders_customer',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['store_id', 'customer_id'],
        name: 'idx_orders_customer',
      })
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_orders_status',
      })
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['store_id', 'payment_status'],
        name: 'idx_orders_payment_status',
      })
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['store_id', 'fulfillment_status'],
        name: 'idx_orders_fulfillment_status',
      })
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['store_id', 'created_at'],
        name: 'idx_orders_created_at',
      })
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        columnNames: ['store_id', 'order_number'],
        isUnique: true,
        name: 'idx_orders_order_number_unique',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders');
  }
}
