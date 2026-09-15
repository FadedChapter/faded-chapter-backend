/**
 * Migration: Create Products Table
 * Core product definitions with store isolation
 *
 * Phase 4: Catalog Domain
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateProductsTable1726350011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'products',
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
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sku',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'is_featured',
            type: 'boolean',
            default: false,
          },
          {
            name: 'display_order',
            type: 'integer',
            default: 0,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'created_by',
            type: 'uuid',
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
      'products',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_products_store_id',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'products',
      new TableIndex({
        columnNames: ['store_id'],
        name: 'idx_products_store',
      })
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        columnNames: ['store_id', 'slug'],
        isUnique: true,
        name: 'idx_products_slug_unique',
      })
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_products_status',
      })
    );

    await queryRunner.createIndex(
      'products',
      new TableIndex({
        columnNames: ['created_at'],
        name: 'idx_products_created_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('products');
  }
}
