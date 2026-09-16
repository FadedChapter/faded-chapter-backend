/**
 * Migration: Create Order Number Counters Table
 *
 * Order numbers were allocated by reading MAX from `orders` and adding one — a
 * read-then-write, so two concurrent checkouts could compute the same number
 * and one would lose to idx_orders_number.
 *
 * This table makes allocation atomic. A single upsert increments the counter
 * under a row lock and returns the number it reserved, so no two callers can
 * be handed the same value, and two sequential calls return two different
 * numbers without anything having to be inserted in between.
 *
 * `next_value` is the next number to hand out. It is seeded on first use from
 * the highest existing order number for that store, so numbering continues
 * from the real data rather than restarting.
 */

import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOrderNumberCountersTable1726350026000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'order_number_counters',
        columns: [
          {
            name: 'store_id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            // The next number to allocate. Bare integer, not the formatted
            // string: the prefix and zero padding are presentation and belong
            // in one place in the code, not spread through the data.
            name: 'next_value',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_number_counters');
  }
}
