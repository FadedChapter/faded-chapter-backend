/**
 * Migration: Create Customer Preferences Table
 * Communication and display preferences
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateCustomerPreferencesTable1726350004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'customer_preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'customer_id',
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
            name: 'email_newsletter',
            type: 'boolean',
            default: false,
          },
          {
            name: 'email_promotions',
            type: 'boolean',
            default: false,
          },
          {
            name: 'email_product_updates',
            type: 'boolean',
            default: false,
          },
          {
            name: 'email_transactional',
            type: 'boolean',
            default: true,
          },
          {
            name: 'sms_marketing',
            type: 'boolean',
            default: false,
          },
          {
            name: 'language',
            type: 'varchar',
            length: '10',
            default: "'en'",
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '50',
            default: "'UTC'",
          },
          {
            name: 'save_payment_method',
            type: 'boolean',
            default: false,
          },
          {
            name: 'auto_apply_rewards',
            type: 'boolean',
            default: false,
          },
          {
            name: 'custom_settings',
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

    // Add composite FK
    await queryRunner.createForeignKey(
      'customer_preferences',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
        name: 'fk_customer_preferences_customer',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('customer_preferences');
  }
}
