/**
 * Migration: Create Discount Applications Table
 * Track discount applications to carts and orders
 *
 * Phase 7: Promotions & Discounts
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateDiscountApplicationsTable1726350021000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'discount_applications',
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
            name: 'promo_code_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'cart_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'discount_amount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'discount_percentage',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'discount_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
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
        ],
      }),
      true
    );

    // Add FK to stores
    await queryRunner.createForeignKey(
      'discount_applications',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_discount_applications_store',
      })
    );

    // Add FK to promo_codes
    await queryRunner.createForeignKey(
      'discount_applications',
      new TableForeignKey({
        columnNames: ['promo_code_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'promo_codes',
        onDelete: 'RESTRICT',
        name: 'fk_discount_applications_promo_code',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'discount_applications',
      new TableIndex({
        columnNames: ['store_id', 'cart_id'],
        name: 'idx_discount_applications_cart',
      })
    );

    await queryRunner.createIndex(
      'discount_applications',
      new TableIndex({
        columnNames: ['store_id', 'order_id'],
        name: 'idx_discount_applications_order',
      })
    );

    await queryRunner.createIndex(
      'discount_applications',
      new TableIndex({
        columnNames: ['store_id', 'promo_code_id'],
        name: 'idx_discount_applications_promo_code',
      })
    );

    await queryRunner.createIndex(
      'discount_applications',
      new TableIndex({
        columnNames: ['store_id', 'created_at'],
        name: 'idx_discount_applications_created_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('discount_applications');
  }
}
