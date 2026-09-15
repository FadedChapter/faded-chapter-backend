/**
 * Migration: Create Cart Lines Table
 * Items in shopping carts
 *
 * Phase 6: Cart & Checkout
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCartLinesTable1726350019000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'cart_lines',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'cart_id',
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

    // Add composite FK to carts
    await queryRunner.createForeignKey(
      'cart_lines',
      new TableForeignKey({
        columnNames: ['cart_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'carts',
        onDelete: 'CASCADE',
        name: 'fk_cart_lines_cart',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'cart_lines',
      new TableIndex({
        columnNames: ['cart_id', 'store_id'],
        name: 'idx_cart_lines_cart',
      })
    );

    await queryRunner.createIndex(
      'cart_lines',
      new TableIndex({
        columnNames: ['store_id', 'product_variant_id'],
        name: 'idx_cart_lines_variant',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cart_lines');
  }
}
