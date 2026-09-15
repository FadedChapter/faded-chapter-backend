/**
 * Migration: Create Shipping Rates Table
 * Weight-based shipping rates per method and zone
 *
 * Phase 8: Shipping Integration
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateShippingRatesTable1726350023000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'shipping_rates',
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
            name: 'method_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'weight_min',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'weight_max',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'zone_code',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'base_rate',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'rate_per_unit',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'active',
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

    // Add FKs to stores and shipping_methods
    await queryRunner.createForeignKey(
      'shipping_rates',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_shipping_rates_store',
      })
    );

    await queryRunner.createForeignKey(
      'shipping_rates',
      new TableForeignKey({
        columnNames: ['method_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'shipping_methods',
        onDelete: 'RESTRICT',
        name: 'fk_shipping_rates_method',
      })
    );

    // Create indexes for query performance
    await queryRunner.createIndex(
      'shipping_rates',
      new TableIndex({
        columnNames: ['store_id', 'method_id', 'active'],
        name: 'idx_shipping_rates_method_active',
      })
    );

    await queryRunner.createIndex(
      'shipping_rates',
      new TableIndex({
        columnNames: ['store_id', 'zone_code'],
        name: 'idx_shipping_rates_zone',
      })
    );

    await queryRunner.createIndex(
      'shipping_rates',
      new TableIndex({
        columnNames: ['method_id', 'weight_min', 'weight_max'],
        name: 'idx_shipping_rates_weight_range',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('shipping_rates');
  }
}
