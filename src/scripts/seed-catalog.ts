/**
 * Seed the catalogue into Postgres.
 *
 * The storefront rendered twelve hardcoded products and never called the API;
 * the admin managed six rows nobody saw. This moves the catalogue into the
 * database so there is one of it.
 *
 * Idempotent and strictly additive. It matches existing rows by slug and
 * updates them in place rather than replacing anything, because 53 order lines
 * reference four existing variants — deleting those would either break order
 * history or be refused by the foreign key. Variants are upserted by SKU and
 * never removed; a variant that has been retired from the catalogue keeps its
 * row and is marked inactive instead.
 *
 * Run with: npm run seed:catalog -- <path-to-catalog.json>
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../core/config/env';
import { initializeLogger } from '../core/logging/logger';
import { initializeDatabase, getDataSource, closeDatabase } from '../core/database/postgres-data-source';

interface SeedImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

interface SeedVariant {
  id: string;
  size: string;
  colour: string;
  price: number;
  currency: string;
  stock: number;
  availability: string;
  impactColourFamilyId?: string;
}

interface SeedProduct {
  id: string;
  slug: string;
  name: string;
  collection: string;
  category: string;
  department: string;
  pillar?: string;
  sizeSystemId?: string;
  description: string;
  material: string;
  fit: string;
  styleTags: string[];
  priceTier: string;
  badge?: string | null;
  merchandisingPriority: number;
  releasedAt: number;
  styleWith: string[];
  images: {
    primary: SeedImage;
    hover: SeedImage;
    byColour?: Record<string, { primary: SeedImage; hover: SeedImage; gallery?: SeedImage[] }>;
  };
  variants: SeedVariant[];
}

const STORE_ID = process.env['DEFAULT_STORE_ID'] ?? '550e8400-e29b-41d4-a716-446655440000';

/**
 * Existing rows use a "the-" prefix the storefront's URLs do not.
 * The storefront slug wins: it is what customers and search engines already
 * have. Matching ignores the prefix so the two catalogues line up.
 */
function slugKey(slug: string): string {
  return slug.replace(/^the-/, '');
}

/** A stable, readable SKU per variant — the natural key for upserting. */
function variantSku(product: SeedProduct, variant: SeedVariant): string {
  const base = product.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  const colour = variant.colour.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return `${base}-${colour}-${variant.size}`.slice(0, 100);
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    throw new Error('Usage: seed-catalog <path-to-catalog.json>');
  }

  loadConfig();
  initializeLogger();
  await initializeDatabase();
  const ds = getDataSource();

  const products = JSON.parse(readFileSync(file, 'utf8')) as SeedProduct[];
  console.log(`seeding ${products.length} products`);

  // Existing rows, keyed by their prefix-stripped slug.
  const existing = await ds.query(`SELECT id, slug FROM products WHERE store_id = $1`, [STORE_ID]);
  const bySlug = new Map<string, string>(
    existing.map((r: { id: string; slug: string }) => [slugKey(r.slug), r.id]),
  );

  let created = 0;
  let updated = 0;
  let variantsUpserted = 0;
  let imagesWritten = 0;
  let variantsRetired = 0;

  for (const p of products) {
    const key = slugKey(p.slug);
    const existingId = bySlug.get(key);
    const productId = existingId ?? randomUUID();

    const merch = [
      p.collection, p.category, p.department, p.pillar ?? null, p.material, p.fit,
      p.priceTier, p.badge ?? null, p.sizeSystemId ?? null, p.merchandisingPriority,
      new Date(p.releasedAt), JSON.stringify(p.styleTags), JSON.stringify(p.styleWith),
    ];

    if (existingId) {
      await ds.query(
        `UPDATE products SET
           name = $2, slug = $3, description = $4,
           collection = $5, category = $6, department = $7, pillar = $8,
           material = $9, fit = $10, price_tier = $11, badge = $12,
           size_system_id = $13, merchandising_priority = $14, released_at = $15,
           style_tags = $16::jsonb, style_with = $17::jsonb, updated_at = now()
         WHERE id = $1`,
        [productId, p.name, p.slug, p.description, ...merch],
      );
      updated += 1;
    } else {
      await ds.query(
        `INSERT INTO products
           (id, store_id, name, slug, description, sku, status, is_featured, display_order,
            metadata, created_at, updated_at,
            collection, category, department, pillar, material, fit, price_tier, badge,
            size_system_id, merchandising_priority, released_at, style_tags, style_with)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', false, 0, '{}'::jsonb, now(), now(),
                 $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb)`,
        [productId, STORE_ID, p.name, p.slug, p.description, p.slug.toUpperCase().slice(0, 50), ...merch],
      );
      created += 1;
    }

    // ---- variants -------------------------------------------------------
    for (const [i, v] of p.variants.entries()) {
      const sku = variantSku(p, v);
      const attributes = JSON.stringify({
        colour: v.colour,
        size: v.size,
        ...(v.impactColourFamilyId ? { impactColourFamilyId: v.impactColourFamilyId } : {}),
      });

      const [existingVariant] = await ds.query(
        `SELECT id FROM product_variants WHERE store_id = $1 AND sku = $2`,
        [STORE_ID, sku],
      );
      const variantId = existingVariant?.id ?? randomUUID();

      if (existingVariant) {
        await ds.query(
          `UPDATE product_variants SET
             product_id = $2, name = $3, price = $4, attributes = $5::jsonb,
             status = 'active', display_order = $6, updated_at = now()
           WHERE id = $1`,
          [variantId, productId, `${v.colour} / ${v.size}`, v.price, attributes, i],
        );
      } else {
        await ds.query(
          `INSERT INTO product_variants
             (id, product_id, store_id, sku, name, price, attributes, status, display_order,
              created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', $8, now(), now())`,
          [variantId, productId, STORE_ID, sku, `${v.colour} / ${v.size}`, v.price, attributes, i],
        );
      }
      variantsUpserted += 1;

      // Stock. Existing counts are left alone — the admin may have adjusted
      // them since, and the seed is not the authority on what is on the shelf.
      const [inv] = await ds.query(
        `SELECT id FROM inventory WHERE store_id = $1 AND variant_id = $2`,
        [STORE_ID, variantId],
      );
      if (!inv) {
        await ds.query(
          `INSERT INTO inventory
             (id, variant_id, store_id, quantity_available, quantity_reserved,
              reorder_level, reorder_quantity, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 0, 3, 12, now(), now())`,
          [randomUUID(), variantId, STORE_ID, v.stock],
        );
      }
    }

    /*
     * Retire variants this product had before the catalogue arrived.
     *
     * The four products that existed in both had their own variants — the
     * crewneck carried Bone/M under SKU FC-HWC-BONE while the catalogue brings
     * Bone/M as HEAVYWEIGHT-CREWNECK-BONE-M. Left alone, the shop would offer
     * the same size and colour twice, and in some cases offer colours the
     * catalogue no longer sells.
     *
     * They are marked inactive rather than deleted: 53 order lines point at
     * four of them, and an order must still be able to say what was bought.
     * The storefront filters on status, so they disappear from sale while
     * staying legible in history.
     */
    const keptSkus = p.variants.map((v) => variantSku(p, v));
    const retired = await ds.query(
      `UPDATE product_variants
          SET status = 'inactive', updated_at = now()
        WHERE product_id = $1 AND store_id = $2
          AND NOT (sku = ANY($3))
          AND status <> 'inactive'
        RETURNING sku`,
      [productId, STORE_ID, keptSkus],
    );
    variantsRetired += retired.length;

    // ---- images ---------------------------------------------------------
    // Safe to replace: nothing references an image row.
    await ds.query(`DELETE FROM product_images WHERE product_id = $1 AND store_id = $2`, [
      productId,
      STORE_ID,
    ]);

    const rows: [string | null, string, SeedImage, number][] = [
      [null, 'primary', p.images.primary, 0],
      [null, 'hover', p.images.hover, 1],
    ];
    for (const [colour, set] of Object.entries(p.images.byColour ?? {})) {
      rows.push([colour, 'primary', set.primary, 0], [colour, 'hover', set.hover, 1]);
      (set.gallery ?? []).forEach((g, gi) => rows.push([colour, 'gallery', g, 2 + gi]));
    }

    for (const [colour, role, img, order] of rows) {
      await ds.query(
        `INSERT INTO product_images
           (id, product_id, store_id, url, alt_text, display_order, is_primary,
            colour, role, width, height, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
        [randomUUID(), productId, STORE_ID, img.src, img.alt, order, role === 'primary',
         colour, role, img.width, img.height],
      );
      imagesWritten += 1;
    }
  }

  console.log(`  products  : ${created} created, ${updated} updated`);
  console.log(`  variants  : ${variantsUpserted} upserted, ${variantsRetired} retired`);
  console.log(`  images    : ${imagesWritten} written`);

  const [totals] = await ds.query(
    `SELECT
       (SELECT COUNT(*)::int FROM products WHERE store_id = $1) AS products,
       (SELECT COUNT(*)::int FROM product_variants WHERE store_id = $1) AS variants,
       (SELECT COUNT(*)::int FROM product_images WHERE store_id = $1) AS images`,
    [STORE_ID],
  );
  console.log('  totals now:', JSON.stringify(totals));

  await closeDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
