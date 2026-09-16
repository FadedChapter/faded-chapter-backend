/**
 * Migration: Create Order Lines Table
 * Line items for orders
 *
 * Phase 5: Order Management
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateOrderLinesTable1726350017000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'order_lines',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'product_variant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'product_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'unit_price',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'line_total',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'sku',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'product_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'variant_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'fulfillment_status',
            type: 'varchar',
            length: '50',
            default: "'unfulfilled'",
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
        ],
      }),
      true
    );

    // Add composite FK to orders
    await queryRunner.createForeignKey(
      'order_lines',
      new TableForeignKey({
        columnNames: ['order_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
        name: 'fk_order_lines_order',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'order_lines',
      new TableIndex({
        columnNames: ['order_id', 'store_id'],
        name: 'idx_order_lines_order',
      })
    );

    await queryRunner.createIndex(
      'order_lines',
      new TableIndex({
        columnNames: ['store_id', 'product_variant_id'],
        name: 'idx_order_lines_variant',
      })
    );

    await queryRunner.createIndex(
      'order_lines',
      new TableIndex({
        columnNames: ['store_id', 'fulfillment_status'],
        name: 'idx_order_lines_fulfillment',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_lines');
  }
}
