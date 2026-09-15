/**
 * Migration: Create Inventory Table
 * Stock tracking with reservations
 *
 * Phase 4: Catalog Domain
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInventoryTable1726350014000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'variant_id',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'quantity_available',
            type: 'integer',
            default: 0,
          },
          {
            name: 'quantity_reserved',
            type: 'integer',
            default: 0,
          },
          {
            name: 'reorder_level',
            type: 'integer',
            default: 0,
          },
          {
            name: 'reorder_quantity',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_counted_at',
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
        ],
      }),
      true
    );

    // Note: Foreign key to product_variants is commented out due to schema design
    // Product variants uses composite PK (id, product_id, store_id) but inventory only has (variant_id, store_id)
    // This can be revisited in a future schema refactor

    // await queryRunner.createForeignKey(
    //   'inventory',
    //   new TableForeignKey({
    //     columnNames: ['variant_id', 'store_id'],
    //     referencedColumnNames: ['id', 'store_id'],
    //     referencedTableName: 'product_variants',
    //     onDelete: 'CASCADE',
    //     name: 'fk_inventory_variant',
    //   })
    // );

    // Create indexes
    await queryRunner.createIndex(
      'inventory',
      new TableIndex({
        columnNames: ['variant_id', 'store_id'],
        name: 'idx_inventory_variant',
      })
    );

    await queryRunner.createIndex(
      'inventory',
      new TableIndex({
        columnNames: ['store_id'],
        name: 'idx_inventory_store',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inventory');
  }
}
