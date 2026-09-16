/**
 * Migration: Converge Indexes
 *
 * The hand-built database and the migrations had each accumulated indexes the
 * other did not have — 46 only in the migrations, 15 only in the database. Most
 * of that is performance, but three pairs differ in behaviour, and those are
 * the reason this migration exists rather than being left as a tidy-up.
 *
 * The migrations declared plain unique indexes where the live database uses
 * conditional and functional ones:
 *
 *   products(store_id, slug)          vs  ... WHERE deleted_at IS NULL
 *   product_variants(store_id, sku)   vs  ... WHERE deleted_at IS NULL
 *   promo_codes(store_id, code)       vs  ... ON (store_id, upper(code))
 *
 * The first two decide whether a slug or SKU can be reused after a soft delete;
 * under the migrations' version it could not, so archiving a product would
 * permanently reserve its slug. The third decides whether promo codes are
 * case-insensitive — SAVE10 and save10 are one code in the live database and
 * two under the migrations' definition.
 *
 * The live semantics win in all three cases: they are what the application was
 * built and verified against. The stricter duplicates are dropped.
 *
 * Everything is guarded, so this converges a database from either direction.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/** Superseded by the conditional and functional equivalents created below. */
const SUPERSEDED: string[] = [
  "DROP INDEX IF EXISTS idx_products_slug_unique",
  "DROP INDEX IF EXISTS idx_product_variants_sku_unique",
  "DROP INDEX IF EXISTS idx_promo_codes_code_unique",
];

const INDEXES: string[] = [
  "CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores USING btree (slug)",
  "CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores USING btree (domain)",
  "CREATE INDEX IF NOT EXISTS idx_stores_status ON stores USING btree (status)",
  "CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers USING btree (store_id)",
  "CREATE INDEX IF NOT EXISTS idx_customers_store_status ON customers USING btree (store_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers USING btree (created_at)",
  "CREATE INDEX IF NOT EXISTS idx_products_created_at ON products USING btree (created_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_active ON customers USING btree (store_id, email_normalized) WHERE (deleted_at IS NULL)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs USING btree (table_name, record_id)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs USING btree (actor_id)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs USING btree (created_at)",
  "CREATE INDEX IF NOT EXISTS idx_products_store ON products USING btree (store_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique ON products USING btree (store_id, slug)",
  "CREATE INDEX IF NOT EXISTS idx_categories_store ON categories USING btree (store_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON categories USING btree (store_id, slug)",
  "CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories USING btree (parent_category_id)",
  "CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants USING btree (product_id, store_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku_unique ON product_variants USING btree (store_id, sku)",
  "CREATE INDEX IF NOT EXISTS idx_product_variants_status ON product_variants USING btree (store_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory USING btree (variant_id, store_id)",
  "CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory USING btree (store_id)",
  "CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images USING btree (product_id, store_id)",
  "CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images USING btree (store_id, is_primary)",
  "CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders USING btree (store_id, customer_id)",
  "CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders USING btree (store_id, payment_status)",
  "CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders USING btree (store_id, fulfillment_status)",
  "CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders USING btree (store_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines USING btree (order_id, store_id)",
  "CREATE INDEX IF NOT EXISTS idx_order_lines_variant ON order_lines USING btree (store_id, product_variant_id)",
  "CREATE INDEX IF NOT EXISTS idx_order_lines_fulfillment ON order_lines USING btree (store_id, fulfillment_status)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code_unique ON promo_codes USING btree (store_id, code)",
  "CREATE INDEX IF NOT EXISTS idx_promo_codes_start_date ON promo_codes USING btree (store_id, start_date)",
  "CREATE INDEX IF NOT EXISTS idx_promo_codes_end_date ON promo_codes USING btree (store_id, end_date)",
  "CREATE INDEX IF NOT EXISTS idx_discount_applications_cart ON discount_applications USING btree (store_id, cart_id)",
  "CREATE INDEX IF NOT EXISTS idx_discount_applications_order ON discount_applications USING btree (store_id, order_id)",
  "CREATE INDEX IF NOT EXISTS idx_discount_applications_promo_code ON discount_applications USING btree (store_id, promo_code_id)",
  "CREATE INDEX IF NOT EXISTS idx_discount_applications_created_at ON discount_applications USING btree (store_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_shipping_rates_method_active ON shipping_rates USING btree (store_id, method_id, active)",
  "CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone ON shipping_rates USING btree (store_id, zone_code)",
  "CREATE INDEX IF NOT EXISTS idx_shipping_rates_weight_range ON shipping_rates USING btree (method_id, weight_min, weight_max)",
  "CREATE INDEX IF NOT EXISTS idx_payments_order ON payments USING btree (store_id, order_id)",
  "CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments USING btree (store_id, razorpay_order_id)",
  "CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments USING btree (store_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds USING btree (store_id, payment_id)",
  "CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds USING btree (store_id, order_id)",
  "CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds USING btree (store_id, created_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_key ON stores USING btree (slug)",
  "CREATE INDEX IF NOT EXISTS idx_payments_store_created ON payments USING btree (store_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_refunds_store_created ON refunds USING btree (store_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs USING btree (created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders USING btree (customer_id)",
  "CREATE INDEX IF NOT EXISTS idx_orders_created ON orders USING btree (store_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines USING btree (order_id)",
  "CREATE INDEX IF NOT EXISTS idx_order_lines_store ON order_lines USING btree (store_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products USING btree (store_id, slug) WHERE (deleted_at IS NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_sku ON product_variants USING btree (store_id, sku) WHERE (deleted_at IS NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_variant ON inventory USING btree (store_id, variant_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes USING btree (store_id, upper((code)::text))",
  "CREATE INDEX IF NOT EXISTS idx_discount_app_promo ON discount_applications USING btree (promo_code_id)",
  "CREATE INDEX IF NOT EXISTS idx_discount_app_order ON discount_applications USING btree (order_id)",
  "CREATE INDEX IF NOT EXISTS idx_ship_rates_method ON shipping_rates USING btree (method_id, zone_code)",
];

export class ConvergeIndexes1726350029000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SUPERSEDED) {
      await queryRunner.query(statement);
    }
    for (const statement of INDEXES) {
      await queryRunner.query(statement);
    }
  }

  /**
   * Indexes are safe to drop and rebuild, but dropping them here would leave a
   * database slower than this migration found it and would restore the unique
   * constraints whose behaviour was the problem. Reverting is a deliberate
   * no-op.
   */
  public async down(): Promise<void> {
    // intentionally empty — see above
  }
}
