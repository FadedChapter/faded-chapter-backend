/**
 * Migration: Create Promo Codes Table
 * Promotional codes and discount rules
 *
 * Phase 7: Promotions & Discounts
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePromoCodesTable1726350020000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'promo_codes',
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
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'discount_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'discount_value',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
          },
          {
            name: 'usage_limit',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'usage_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'min_purchase',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'max_discount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'applicable_products',
            type: 'jsonb',
            default: 'null',
          },
          {
            name: 'applicable_categories',
            type: 'jsonb',
            default: 'null',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'start_date',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'end_date',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'stackable',
            type: 'boolean',
            default: true,
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

    // Add FK to stores
    await queryRunner.createForeignKey(
      'promo_codes',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_promo_codes_store',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'promo_codes',
      new TableIndex({
        columnNames: ['store_id', 'code'],
        isUnique: true,
        name: 'idx_promo_codes_code_unique',
      })
    );

    await queryRunner.createIndex(
      'promo_codes',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_promo_codes_status',
      })
    );

    await queryRunner.createIndex(
      'promo_codes',
      new TableIndex({
        columnNames: ['store_id', 'start_date'],
        name: 'idx_promo_codes_start_date',
      })
    );

    await queryRunner.createIndex(
      'promo_codes',
      new TableIndex({
        columnNames: ['store_id', 'end_date'],
        name: 'idx_promo_codes_end_date',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('promo_codes');
  }
}
