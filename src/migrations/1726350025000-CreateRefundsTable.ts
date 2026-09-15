/**
 * Migration: Create Refunds Table
 * Refunds and their lifecycle with manual approval
 *
 * Phase 9: Payment Processing
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateRefundsTable1726350025000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'refunds',
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
            name: 'payment_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'razorpay_refund_id',
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
            name: 'reason',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending_approval'",
          },
          {
            name: 'approved_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approval_date',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'approval_notes',
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

    // Add FKs to stores, payments, and orders
    await queryRunner.createForeignKey(
      'refunds',
      new TableForeignKey({
        columnNames: ['store_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'stores',
        onDelete: 'RESTRICT',
        name: 'fk_refunds_store',
      })
    );

    await queryRunner.createForeignKey(
      'refunds',
      new TableForeignKey({
        columnNames: ['payment_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'payments',
        onDelete: 'RESTRICT',
        name: 'fk_refunds_payment',
      })
    );

    await queryRunner.createForeignKey(
      'refunds',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'RESTRICT',
        name: 'fk_refunds_order',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'refunds',
      new TableIndex({
        columnNames: ['store_id', 'payment_id'],
        name: 'idx_refunds_payment',
      })
    );

    await queryRunner.createIndex(
      'refunds',
      new TableIndex({
        columnNames: ['store_id', 'order_id'],
        name: 'idx_refunds_order',
      })
    );

    await queryRunner.createIndex(
      'refunds',
      new TableIndex({
        columnNames: ['store_id', 'status'],
        name: 'idx_refunds_status',
      })
    );

    await queryRunner.createIndex(
      'refunds',
      new TableIndex({
        columnNames: ['store_id', 'created_at'],
        name: 'idx_refunds_created_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refunds');
  }
}
