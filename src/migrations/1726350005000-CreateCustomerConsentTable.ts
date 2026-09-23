/**
 * Migration: Create Customer Consent Table
 * Immutable append-only consent history with PostgreSQL trigger
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCustomerConsentTable1726350005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'customer_consents',
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
            name: 'consent_type',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'granted',
            type: 'boolean',
            isNullable: false,
          },
          {
            name: 'policy_version',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'policy_url',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'ip_address',
            type: 'inet',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
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

    // Add composite FK (RESTRICT to prevent accidental cascading deletes)
    await queryRunner.createForeignKey(
      'customer_consents',
      new TableForeignKey({
        columnNames: ['customer_id', 'store_id'],
        referencedColumnNames: ['id', 'store_id'],
        referencedTableName: 'customers',
        onDelete: 'RESTRICT',
        name: 'fk_customer_consent_customer',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'customer_consents',
      new TableIndex({
        columnNames: ['customer_id', 'store_id'],
        name: 'idx_customer_consent_customer',
      })
    );

    await queryRunner.createIndex(
      'customer_consents',
      new TableIndex({
        columnNames: ['customer_id', 'store_id', 'consent_type'],
        name: 'idx_customer_consent_type',
      })
    );

    // Create immutability trigger - prevent updates and deletes
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_customer_consent_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          RAISE EXCEPTION 'Customer consent records are immutable and cannot be updated';
        ELSIF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Customer consent records are immutable and cannot be deleted';
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER prevent_customer_consent_mutation
      BEFORE UPDATE OR DELETE ON customer_consents
      FOR EACH ROW
      EXECUTE FUNCTION prevent_customer_consent_mutation();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger and function
    await queryRunner.query('DROP TRIGGER IF EXISTS prevent_customer_consent_mutation ON customer_consents');
    await queryRunner.query('DROP FUNCTION IF EXISTS prevent_customer_consent_mutation');

    // Drop table
    await queryRunner.dropTable('customer_consents');
  }
}
