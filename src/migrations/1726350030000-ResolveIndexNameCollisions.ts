/**
 * Migration: Resolve Index Name Collisions
 *
 * Three index names existed in both the hand-built database and the migrations
 * but meant different things, so the guarded CREATE IF NOT EXISTS in the
 * previous migration skipped them — the name was taken, by a different index.
 *
 *   idx_orders_customer     (customer_id)              vs (store_id, customer_id)
 *   idx_order_lines_order   (order_id)                 vs (order_id, store_id)
 *   idx_inventory_variant   UNIQUE (store_id, variant_id) vs (variant_id, store_id)
 *
 * The first two are settled in favour of the store-scoped pair. Every query in
 * this codebase filters by store_id first — it is applied unconditionally by
 * BaseRepository rather than being a caller-supplied filter — so an index that
 * leads with store_id is the one that actually gets used.
 *
 * The third is not a preference. The live index is UNIQUE and the migrations'
 * was not, and that uniqueness is a real constraint: one inventory row per
 * variant per store. Without it the same variant can acquire two stock rows and
 * the counts silently disagree. The unique version wins.
 *
 * Dropping and recreating an index is safe — no data is touched, and the table
 * is briefly unindexed on that column.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

const RESOLUTIONS: { name: string; create: string }[] = [
  {
    name: 'idx_orders_customer',
    create: 'CREATE INDEX idx_orders_customer ON orders (store_id, customer_id)',
  },
  {
    name: 'idx_order_lines_order',
    create: 'CREATE INDEX idx_order_lines_order ON order_lines (order_id, store_id)',
  },
  {
    name: 'idx_inventory_variant',
    create: 'CREATE UNIQUE INDEX idx_inventory_variant ON inventory (store_id, variant_id)',
  },
];

export class ResolveIndexNameCollisions1726350030000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { name, create } of RESOLUTIONS) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${name}`);
      await queryRunner.query(create);
    }

    // The entity-generated unique constraint on inventory(variant_id) alone is
    // wrong for a multi-store platform: it would stop two stores from each
    // holding stock for their own variant. idx_inventory_variant above covers
    // the correct scope.
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT conname INTO c FROM pg_constraint
         WHERE conrelid = 'inventory'::regclass AND contype = 'u'
           AND pg_get_constraintdef(oid) = 'UNIQUE (variant_id)';
        IF c IS NOT NULL THEN
          EXECUTE format('ALTER TABLE inventory DROP CONSTRAINT %I', c);
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // No-op: reverting would reinstate a non-unique inventory index and the
    // store-blind variants of the other two. See above.
  }
}
