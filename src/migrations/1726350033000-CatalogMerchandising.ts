/**
 * Migration: Catalog Merchandising
 *
 * The storefront and the admin were serving two different catalogues. The shop
 * rendered a hardcoded list of twelve products and never called the API at all;
 * the admin managed six rows in Postgres that no customer ever saw. Editing a
 * price in the admin changed nothing on the shop.
 *
 * Closing that means the database has to be able to hold what the storefront
 * actually renders. These columns are the difference between the two: the
 * commerce facts (name, price, stock, published state) were already here, but
 * the merchandising that decides how a product is presented was not.
 *
 * Every column is nullable. Products that predate this migration keep working
 * with these unset, and the API omits what is absent rather than inventing it.
 *
 * On `category`: the existing categories table holds every-day / off-duty /
 * after-hour, which are the storefront's *pillars*, not its categories — the
 * storefront's taxonomy is tops / bottoms / outerwear / accessories. Rather
 * than redefine a table the admin already filters on, both are stored here as
 * their own columns and the categories table is left alone.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogMerchandising1726350033000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const productColumns: [string, string][] = [
      ['collection', 'varchar(80)'],
      ['category', 'varchar(40)'],
      ['department', 'varchar(40)'],
      ['pillar', 'varchar(40)'],
      ['material', 'varchar(255)'],
      ['fit', 'varchar(80)'],
      ['price_tier', 'varchar(40)'],
      ['badge', 'varchar(40)'],
      ['size_system_id', 'varchar(40)'],
      ['merchandising_priority', 'integer'],
      ['released_at', 'timestamptz'],
      // Arrays rather than join tables: these are presentation lists the
      // storefront reads whole and never queries across.
      ['style_tags', 'jsonb'],
      ['style_with', 'jsonb'],
    ];
    for (const [name, type] of productColumns) {
      await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    }

    // Storefront cards are ordered by merchandising priority, then recency.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_products_merchandising
         ON products (store_id, merchandising_priority DESC, released_at DESC)`,
    );

    /*
     * Images are per colour, and each colour carries a primary shot, a hover
     * shot and optional gallery frames. Without these the table can record that
     * a product has pictures but not which colour they belong to or which role
     * each one plays, which is exactly what the storefront needs to know.
     *
     * width/height are stored because the markup sets them to reserve space —
     * an image whose dimensions arrive late shifts the layout under the reader.
     */
    const imageColumns: [string, string][] = [
      ['colour', 'varchar(60)'],
      ['role', "varchar(20) NOT NULL DEFAULT 'gallery'"],
      ['width', 'integer'],
      ['height', 'integer'],
    ];
    for (const [name, type] of imageColumns) {
      await queryRunner.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_product_images_role
         ON product_images (product_id, colour, role, display_order)`,
    );
  }

  /**
   * Down drops only the columns this migration introduced. It does not restore
   * the hardcoded catalogue — that lived in the frontend, and reverting the
   * schema does not put it back.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_product_images_role`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_merchandising`);
    for (const name of ['colour', 'role', 'width', 'height']) {
      await queryRunner.query(`ALTER TABLE product_images DROP COLUMN IF EXISTS ${name}`);
    }
    for (const name of [
      'collection', 'category', 'department', 'pillar', 'material', 'fit',
      'price_tier', 'badge', 'size_system_id', 'merchandising_priority',
      'released_at', 'style_tags', 'style_with',
    ]) {
      await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS ${name}`);
    }
  }
}
