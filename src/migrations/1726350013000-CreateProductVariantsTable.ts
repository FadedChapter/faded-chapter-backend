/**
 * Migration: Create Product Variants Table
 * Product variants with SKU-level pricing and attributes
 *
 * Phase 4: Catalog Domain
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateProductVariantsTable1726350013000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'product_variants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'product_id',
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
            name: 'sku',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'price',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'cost',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'weight',
            type: 'numeric',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'attributes',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'display_order',
            type: 'integer',
            default: 0,
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

    // Add composite FK to products
    await queryRunner.createForeignKey(
      'product_variants',
      new TableForeignKey({
        columnNames: ['product_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'products',
        onDelete: 'CASCADE',
        name: 'fk_product_variants_product',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'product_variants',
      new TableIndex({
        columnNames: ['product_id', 'store_id'],
        name: 'idx_product_variants_product',
      })
    );

    await queryRunner.createIndex(
      'product_variants',
      new TableIndex({
        columnNames: ['store_id', 'sku'],
        isUnique: true,
        name: 'idx_product_variants_sku_unique',
      })
    );

    await queryRunner.createIndex(
      'product_variants',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_product_variants_status',
      })
    );

    // Referenced by a foreign key elsewhere. The primary key here is
    // composite, so Postgres needs a unique constraint on exactly the
    // referenced columns before any FK can point at them.
    await queryRunner.createIndex(
      'product_variants',
      new TableIndex({
        columnNames: ['id', 'store_id'],
        isUnique: true,
        name: 'uq_product_variants_id_store',
      })
    );

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product_variants');
  }
}
