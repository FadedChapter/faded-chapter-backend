/**
 * Migration: Create Payments Table
 * Payment attempts and their lifecycle
 *
 * Phase 9: Payment Processing
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePaymentsTable1726350024000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payments',
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
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'razorpay_payment_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'razorpay_order_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'INR'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
            default: "'razorpay'",
          },
          {
            name: 'payment_method_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'last_four',
            type: 'varchar',
            length: '4',
            isNullable: true,
          },
          {
            name: 'card_brand',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'error_code',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'risk_rating',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'risk_reason',
            type: 'text',
            isNullable: true,
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
        ],
      }),
      true
    );

    // Add FKs to stores and customers
    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_payments_store',
      })
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'RESTRICT',
        name: 'fk_payments_customer',
      })
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'SET NULL',
        name: 'fk_payments_order',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        columnNames: ['store_id', 'order_id'],
        name: 'idx_payments_order',
      })
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        columnNames: ['store_id', 'customer_id'],
        name: 'idx_payments_customer',
      })
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_payments_status',
      })
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        columnNames: ['store_id', 'razorpay_payment_id'],
        name: 'idx_payments_razorpay_id',
      })
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        columnNames: ['store_id', 'razorpay_order_id'],
        name: 'idx_payments_razorpay_order_id',
      })
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        columnNames: ['store_id', 'created_at'],
        name: 'idx_payments_created_at',
      })
    );

    // Referenced by a foreign key elsewhere. The primary key here is
    // composite, so Postgres needs a unique constraint on exactly the
    // referenced columns before any FK can point at them.
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        columnNames: ['id'],
        isUnique: true,
        name: 'uq_payments_id',
      })
    );

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payments');
  }
}
