/**
 * Migration: Create Categories Table
 * Hierarchical product categories
 *
 * Phase 4: Catalog Domain
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCategoriesTable1726350012000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'categories',
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
            name: 'parent_category_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'display_order',
            type: 'integer',
            default: 0,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Add foreign key to stores
    await queryRunner.createForeignKey(
      'categories',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_categories_store_id',
      })
    );

    // Add self-referencing FK for parent category
    await queryRunner.createForeignKey(
      'categories',
      new TableForeignKey({
        columnNames: ['parent_category_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'categories',
        onDelete: 'SET NULL',
        name: 'fk_categories_parent',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'categories',
      new TableIndex({
        columnNames: ['store_id'],
        name: 'idx_categories_store',
      })
    );

    await queryRunner.createIndex(
      'categories',
      new TableIndex({
        columnNames: ['store_id', 'slug'],
        isUnique: true,
        name: 'idx_categories_slug_unique',
      })
    );

    await queryRunner.createIndex(
      'categories',
      new TableIndex({
        columnNames: ['parent_category_id'],
        name: 'idx_categories_parent',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('categories');
  }
}
