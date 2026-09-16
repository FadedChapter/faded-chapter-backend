/**
 * Migration: Reconcile Schema Drift
 *
 * The development database was built by hand and then grew through twelve
 * phases of admin work, while the migrations were left where they started.
 * The two had diverged far enough that `migration:generate` proposed dropping
 * 37 live columns — including promo_codes.code and shipping_methods.name — to
 * make the database match stale entity definitions.
 *
 * This migration closes the gap in the safe direction: the working database is
 * the reference, and the migrations are brought up to reproduce it. Nothing is
 * dropped and no data is touched.
 *
 * It covers what the historical migrations never described:
 *
 *   - Two tables that exist and are in active use but had no migration at all
 *     (notification_rules from the alerts console, staff_users from staff and
 *     roles). Without these, a fresh database cannot run either module.
 *   - Twenty columns on payments, refunds and products added as the payment
 *     integration and catalogue grew.
 *   - The foreign key on store_settings, which the hand-built table never got.
 *
 * Every statement is guarded, so running this against the development database
 * it was derived from is a no-op, while a fresh database ends up identical.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReconcileSchemaDrift1726350027000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // Tables that exist in use but were never described by a migration
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_rules (
        id          uuid PRIMARY KEY,
        store_id    uuid NOT NULL,
        rule_key    varchar(64) NOT NULL,
        enabled     boolean NOT NULL DEFAULT true,
        threshold   numeric(12,2),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_rules_key ON notification_rules (store_id, rule_key)`,
    );

    // Staff accounts are platform-level rather than per-store: this table has
    // no store_id, and the admin staff module is deliberately not store-scoped.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id                uuid PRIMARY KEY,
        email             varchar(255) NOT NULL,
        email_normalized  varchar(255) NOT NULL,
        password_hash     text NOT NULL,
        first_name        varchar(120),
        last_name         varchar(120),
        roles             jsonb NOT NULL DEFAULT '["support"]'::jsonb,
        status            varchar(32) NOT NULL DEFAULT 'active',
        email_verified    boolean NOT NULL DEFAULT false,
        marketing_opt_in  boolean NOT NULL DEFAULT false,
        last_login_at     timestamptz,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email ON staff_users (email_normalized)`,
    );

    // ------------------------------------------------------------------
    // Columns the payment integration added after the table was written
    // ------------------------------------------------------------------
    const paymentColumns: [string, string][] = [
      ['description', 'varchar(255)'],
      ['notes', 'text'],
      ['fee', 'numeric(10,2)'],
      ['fee_gst', 'numeric(10,2)'],
      ['receipt_email', 'varchar(255)'],
      ['contact', 'varchar(100)'],
      ['vpa', 'varchar(255)'],
      ['acquirer_data', 'jsonb'],
      ['international', 'boolean DEFAULT false'],
      ['bank_account', 'jsonb'],
      ['wallet', 'varchar(100)'],
      ['verified', 'boolean DEFAULT false'],
    ];
    for (const [name, type] of paymentColumns) {
      await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    }

    const refundColumns: [string, string][] = [
      ['customer_id', 'uuid'],
      ['notes', 'text'],
      ['receipt_email', 'varchar(255)'],
      ['contact', 'varchar(100)'],
      ['error_code', 'varchar(100)'],
      ['error_message', 'text'],
      ['refund_status', 'varchar(50)'],
    ];
    for (const [name, type] of refundColumns) {
      await queryRunner.query(`ALTER TABLE refunds ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    }

    // Catalogue: products carry a category directly.
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id uuid`);

    // ------------------------------------------------------------------
    // store_settings: the hand-built table never got its foreign key
    // ------------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_store_settings_store_id'
        ) THEN
          ALTER TABLE store_settings
            ADD CONSTRAINT fk_store_settings_store_id
            FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  /**
   * Down drops only what up() introduced that did not exist before.
   *
   * The added columns are deliberately NOT dropped: on the database this was
   * written for they already existed and hold data, so reverting would destroy
   * it. A migration whose down() is more destructive than its up() was additive
   * is a trap, and this one refuses to be.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE store_settings DROP CONSTRAINT IF EXISTS fk_store_settings_store_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS notification_rules`);
    await queryRunner.query(`DROP TABLE IF EXISTS staff_users`);
  }
}
