/**
 * Migration: Create Customer Addresses Table
 * Reusable addresses with composite FK (customer_id, store_id)
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCustomerAddressesTable1726350003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'customer_addresses',
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
          },
          {
            name: 'store_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'address_line_1',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'address_line_2',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'city',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'state_province',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'postal_code',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'country_code',
            type: 'varchar',
            length: '2',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'is_default_shipping',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_default_billing',
            type: 'boolean',
            default: false,
          },
          {
            name: 'label',
            type: 'varchar',
            length: '255',
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

    // Add composite FK (customer_id, store_id) → customers(id, store_id)
    await queryRunner.createForeignKey(
      'customer_addresses',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
        name: 'fk_customer_addresses_customer',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'customer_addresses',
      new TableIndex({
        columnNames: ['customer_id', 'store_id'],
        name: 'idx_customer_addresses_customer',
      })
    );

    await queryRunner.createIndex(
      'customer_addresses',
      new TableIndex({
        columnNames: ['customer_id', 'store_id', 'is_default_shipping'],
        name: 'idx_customer_addresses_default_shipping',
      })
    );

    await queryRunner.createIndex(
      'customer_addresses',
      new TableIndex({
        columnNames: ['customer_id', 'store_id', 'is_default_billing'],
        name: 'idx_customer_addresses_default_billing',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('customer_addresses');
  }
}
