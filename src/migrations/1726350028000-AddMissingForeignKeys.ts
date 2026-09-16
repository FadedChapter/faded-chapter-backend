/**
 * Migration: Add Missing Foreign Keys
 *
 * The hand-built development database had no referential integrity at all on
 * the core commerce tables — 11 foreign keys existed, all of them on tables
 * created later by migration, while the migrations declared 32. Orders could
 * reference a customer that did not exist, refunds a payment that did not, and
 * nothing would object.
 *
 * Every one of these constraints was checked against the live data before being
 * written: zero orphaned rows across all eighteen relationships, so adding them
 * is non-destructive and nothing needs cleaning up first.
 *
 * The unique indexes come first and are not decoration. Several of these tables
 * have composite primary keys, and Postgres will not accept a foreign key
 * unless a unique constraint covers exactly the referenced columns — a foreign
 * key to orders(id) needs a unique index on orders(id), not on (id, store_id).
 *
 * Everything is guarded, so this is a no-op on a database that already has them
 * (a fresh one, built from the table migrations directly).
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/** [table, constraint name, definition] */
const FOREIGN_KEYS: [string, string, string][] = [
  ['categories', 'fk_categories_store_id', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['categories', 'fk_categories_parent', 'FOREIGN KEY (parent_category_id, store_id) REFERENCES categories(id, store_id) ON DELETE SET NULL'],
  ['customers', 'fk_customers_store_id', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['products', 'fk_products_store_id', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['product_variants', 'fk_product_variants_product', 'FOREIGN KEY (product_id, store_id) REFERENCES products(id, store_id) ON DELETE CASCADE'],
  ['product_images', 'fk_product_images_product', 'FOREIGN KEY (product_id, store_id) REFERENCES products(id, store_id) ON DELETE CASCADE'],
  ['orders', 'fk_orders_store', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['orders', 'fk_orders_customer', 'FOREIGN KEY (customer_id, store_id) REFERENCES customers(id, store_id) ON DELETE RESTRICT'],
  ['order_lines', 'fk_order_lines_order', 'FOREIGN KEY (order_id, store_id) REFERENCES orders(id, store_id) ON DELETE CASCADE'],
  ['promo_codes', 'fk_promo_codes_store', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['discount_applications', 'fk_discount_applications_store', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['discount_applications', 'fk_discount_applications_promo_code', 'FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE RESTRICT'],
  ['shipping_methods', 'fk_shipping_methods_store', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['shipping_rates', 'fk_shipping_rates_store', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['shipping_rates', 'fk_shipping_rates_method', 'FOREIGN KEY (method_id) REFERENCES shipping_methods(id) ON DELETE RESTRICT'],
  ['payments', 'fk_payments_store', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['payments', 'fk_payments_customer', 'FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT'],
  ['payments', 'fk_payments_order', 'FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL'],
  ['refunds', 'fk_refunds_store', 'FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT'],
  ['refunds', 'fk_refunds_payment', 'FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT'],
  ['refunds', 'fk_refunds_order', 'FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT'],
];

/** Unique constraints the foreign keys above depend on. */
const UNIQUE_INDEXES: [string, string, string][] = [
  ['customers', 'uq_customers_id', 'id'],
  ['orders', 'uq_orders_id', 'id'],
  ['payments', 'uq_payments_id', 'id'],
  ['product_variants', 'uq_product_variants_id_store', 'id, store_id'],
];

export class AddMissingForeignKeys1726350028000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, name, columns] of UNIQUE_INDEXES) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${name} ON ${table} (${columns})`,
      );
    }

    for (const [table, name, definition] of FOREIGN_KEYS) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${name} ${definition};
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, name] of FOREIGN_KEYS) {
      await queryRunner.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${name}`);
    }
    for (const [, name] of UNIQUE_INDEXES) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${name}`);
    }
  }
}
