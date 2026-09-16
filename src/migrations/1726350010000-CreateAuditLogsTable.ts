/**
 * Migration: Create Audit Logs Table
 * Immutable append-only audit trail with PostgreSQL trigger
 *
 * Phase 3B: Database Migrations
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/*
 * Reconciliation note: store_id was removed from this table.
 *
 * It was declared NOT NULL with a foreign key, but nothing ever wrote it — the
 * audit middleware treats the store as the scope of a request rather than the
 * subject of a record, and its insert omits the column entirely. On a fresh
 * database built from this migration, every audit write would therefore have
 * violated the NOT NULL constraint, been swallowed by the middleware's
 * try/catch, and left the audit trail silently empty. The live table has never
 * had the column, which is why auditing works there.
 *
 * Store-scoped auditing is worth having, but it needs the middleware to supply
 * the value. Add the column back in a new migration alongside that change.
 */
export class CreateAuditLogsTable1726350010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'table_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'record_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'actor_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'actor_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'changes',
            type: 'jsonb',
            default: "'{}'",
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

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        columnNames: ['table_name', 'record_id'],
        name: 'idx_audit_logs_record',
      })
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        columnNames: ['actor_id'],
        name: 'idx_audit_logs_actor',
      })
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        columnNames: ['created_at'],
        name: 'idx_audit_logs_created_at',
      })
    );

    // Create immutability trigger - prevent updates and deletes
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          RAISE EXCEPTION 'Audit logs are immutable and cannot be updated';
        ELSIF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Audit logs are immutable and cannot be deleted';
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER prevent_audit_log_mutation
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger and function
    await queryRunner.query('DROP TRIGGER IF EXISTS prevent_audit_log_mutation ON audit_logs');
    await queryRunner.query('DROP FUNCTION IF EXISTS prevent_audit_log_mutation');

    // Drop table
    await queryRunner.dropTable('audit_logs');
  }
}
