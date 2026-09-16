/**
 * Storefront Catalogue Controller
 *
 * The public, unauthenticated read surface the shop renders from.
 *
 * Only active products are returned. Draft and archived rows exist in the same
 * table and are visible to the admin, but a shopper asking for the catalogue
 * should not learn that an unreleased product exists — so the filter is applied
 * here rather than being left to the caller.
 */

import { Request, Response } from 'express';
import { getDataSource } from '../database/postgres-data-source';
import { logError } from '../logging/logger';
import {
  toStorefrontCatalogue,
  type ImageRow,
  type ProductRow,
  type VariantRow,
} from '../dto/storefront-catalog.dto';

const PRODUCT_COLUMNS = `
  p.id, p.slug, p.name, p.description,
  p.collection, p.category, p.department, p.pillar, p.size_system_id,
  p.material, p.fit, p.style_tags, p.style_with,
  p.price_tier, p.badge, p.merchandising_priority, p.released_at
`;

export class StorefrontCatalogController {
  /** GET /catalog — the whole active catalogue, ready to render. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const catalogue = await this.load(storeId, null);
      res.status(200).json({ success: true, data: catalogue });
    } catch (error) {
      logError('storefront_catalog_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Could not load the catalogue' });
    }
  }

  /** GET /catalog/:slug — one product, same shape as a list entry. */
  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, slug } = req.params;
      const [product] = await this.load(storeId, slug);

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      res.status(200).json({ success: true, data: product });
    } catch (error) {
      logError('storefront_catalog_get_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Could not load the product' });
    }
  }

  /**
   * Three queries rather than one join: a product has many variants and many
   * images, so joining them produces a row per combination and the assembly
   * work moves to deduplicating it. Fetching each set once and grouping in
   * memory is both fewer rows over the wire and simpler to read.
   */
  private async load(storeId: string, slug: string | null) {
    const ds = getDataSource();
    const params: unknown[] = [storeId];
    let filter = `p.store_id = $1 AND p.status = 'active' AND p.deleted_at IS NULL`;
    if (slug) {
      params.push(slug);
      filter += ` AND p.slug = $2`;
    }

    const products: ProductRow[] = await ds.query(
      `SELECT ${PRODUCT_COLUMNS}
         FROM products p
        WHERE ${filter}
        ORDER BY p.merchandising_priority DESC NULLS LAST, p.released_at DESC NULLS LAST, p.name`,
      params,
    );

    if (products.length === 0) {
      return [];
    }

    const ids = products.map((p) => p.id);

    const variants: VariantRow[] = await ds.query(
      `SELECT v.id, v.product_id, v.price, v.attributes, i.quantity_available
         FROM product_variants v
         LEFT JOIN inventory i ON i.variant_id = v.id AND i.store_id = v.store_id
        WHERE v.product_id = ANY($1) AND v.status = 'active' AND v.deleted_at IS NULL
        ORDER BY v.display_order, v.sku`,
      [ids],
    );

    const images: ImageRow[] = await ds.query(
      `SELECT product_id, url, alt_text, colour, role, width, height, display_order
         FROM product_images
        WHERE product_id = ANY($1) AND deleted_at IS NULL
        ORDER BY display_order`,
      [ids],
    );

    return toStorefrontCatalogue(products, variants, images);
  }
}
