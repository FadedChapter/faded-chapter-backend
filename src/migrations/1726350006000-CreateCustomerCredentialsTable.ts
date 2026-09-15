/**
 * Migration: Create Customer Credentials Table
 * Password storage and account lockout tracking
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateCustomerCredentialsTable1726350006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'customer_credentials',
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
            name: 'password_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'hash_algorithm',
            type: 'varchar',
            length: '50',
            default: "'bcrypt'",
          },
          {
            name: 'hash_version',
            type: 'integer',
            default: 1,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'last_login_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'failed_login_attempts',
            type: 'integer',
            default: 0,
          },
          {
            name: 'locked_until',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'password_changed_at',
            type: 'timestamptz',
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

    // Add composite FK
    await queryRunner.createForeignKey(
      'customer_credentials',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
        name: 'fk_customer_credentials_customer',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('customer_credentials');
  }
}
