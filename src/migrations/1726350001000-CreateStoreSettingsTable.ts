/**
 * Migration: Create Store Settings Table
 * Configuration separate from store identity (1:1)
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateStoreSettingsTable1726350001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'store_settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'default_currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'default_timezone',
            type: 'varchar',
            length: '50',
            default: "'UTC'",
          },
          {
            name: 'default_locale',
            type: 'varchar',
            length: '10',
            default: "'en-US'",
          },
          {
            name: 'guest_checkout_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'customer_accounts_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'email_verification_required',
            type: 'boolean',
            default: true,
          },
          {
            name: 'order_confirmation_email',
            type: 'boolean',
            default: true,
          },
          {
            name: 'order_shipped_email',
            type: 'boolean',
            default: true,
          },
          {
            name: 'inventory_tracking_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'low_stock_alert_enabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'tax_calculation_enabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'maintenance_mode',
            type: 'boolean',
            default: false,
          },
          {
            name: 'settings_json',
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

    // Add foreign key
    await queryRunner.createForeignKey(
      'store_settings',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'CASCADE',
        name: 'fk_store_settings_store_id',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('store_settings');
  }
}
