/**
 * Migration: Create Product Images Table
 * Product images with ordering
 *
 * Phase 4: Catalog Domain
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateProductImagesTable1726350015000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'product_images',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'product_id',
            isPrimary: true,
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'store_id',
            isPrimary: true,
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'alt_text',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'display_order',
            type: 'integer',
            default: 0,
          },
          {
            name: 'is_primary',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
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
      'product_images',
      new TableForeignKey({
        columnNames: ['product_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'products',
        onDelete: 'CASCADE',
        name: 'fk_product_images_product',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'product_images',
      new TableIndex({
        columnNames: ['product_id', 'store_id'],
        name: 'idx_product_images_product',
      })
    );

    await queryRunner.createIndex(
      'product_images',
      new TableIndex({
        columnNames: ['store_id', 'is_primary'],
        name: 'idx_product_images_primary',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product_images');
  }
}
