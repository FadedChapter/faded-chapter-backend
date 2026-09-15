/**
 * Admin Product Controller
 *
 * Phase 3: Products / catalogue.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission). Handlers still scope
 * every query by the store taken from the verified token path.
 */

import { Request, Response } from 'express';
import { ProductRepository } from '../repositories/product.repository';
import {
  CategoryRepository,
  VariantRepository,
  InventoryRepository,
  ProductImageRepository,
} from '../repositories/catalog.repositories';
import {
  toAdminProductSummaryDTO,
  toAdminProductDetailDTO,
  toAdminVariantDTO,
  toAdminCategoryDTO,
} from '../dto/product.dto';
import { logError } from '../logging/logger';

const VALID_STATUS = ['active', 'draft', 'archived', 'discontinued'] as const;
type ProductStatus = (typeof VALID_STATUS)[number];

function parseIntOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AdminProductController {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
    private readonly inventory: InventoryRepository,
    private readonly images: ProductImageRepository,
    private readonly categories: CategoryRepository,
  ) {}

  /** GET /products */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const page = Math.max(parseIntOr(req.query['page'], 1), 1);
      const limit = Math.min(Math.max(parseIntOr(req.query['limit'], 25), 1), 100);

      const { rows, total } = await this.products.searchCatalogue(storeId, {
        status: (req.query['status'] as string) || undefined,
        categoryId: (req.query['categoryId'] as string) || undefined,
        search: (req.query['search'] as string) || undefined,
        limit,
        offset: (page - 1) * limit,
      });

      const rollups = await this.products.rollupsFor(storeId, rows.map((r) => r.id));

      res.status(200).json({
        success: true,
        data: {
          products: rows.map((p) => toAdminProductSummaryDTO(p, rollups.get(p.id))),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
          },
        },
      });
    } catch (error) {
      logError('admin_product_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load products' });
    }
  }

  /** GET /products/status-counts */
  async statusCounts(req: Request, res: Response): Promise<void> {
    try {
      const counts = await this.products.countByStatuses(req.params.storeId);
      const complete = VALID_STATUS.reduce<Record<string, number>>((acc, status) => {
        acc[status] = counts[status] ?? 0;
        return acc;
      }, {});
      res.status(200).json({ success: true, data: complete });
    } catch (error) {
      logError('admin_product_counts_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load product counts' });
    }
  }

  /** GET /products/categories */
  async listCategories(req: Request, res: Response): Promise<void> {
    try {
      const rows = await this.categories.getActive(req.params.storeId);
      res.status(200).json({ success: true, data: rows.map(toAdminCategoryDTO) });
    } catch (error) {
      logError('admin_category_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load categories' });
    }
  }

  /** GET /products/:productId */
  async detail(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const variants = await this.variants.findByProductId(productId, storeId);

      // Inventory is per variant; fetched alongside so the detail view can show
      // stock without a second round trip from the client.
      const variantDTOs = await Promise.all(
        variants.map(async (variant) => {
          const inv = await this.inventory.findByVariantId(variant.id, storeId);
          return toAdminVariantDTO(variant, inv);
        }),
      );

      const primary = await this.images.getPrimaryImage(productId, storeId);

      res.status(200).json({
        success: true,
        data: toAdminProductDetailDTO(product, variantDTOs, primary?.url ?? null),
      });
    } catch (error) {
      logError('admin_product_detail_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load product' });
    }
  }

  /**
   * POST /products/:productId/status
   *
   * Unlike orders, catalogue status has no ordered lifecycle — a product may
   * legitimately move between draft, active and archived in any direction. Only
   * the value itself is validated.
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const status = req.body?.status as ProductStatus | undefined;

      if (!status || !VALID_STATUS.includes(status)) {
        res.status(400).json({
          success: false,
          error: `status must be one of: ${VALID_STATUS.join(', ')}`,
        });
        return;
      }

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      if (product.status === status) {
        res.status(409).json({ success: false, error: `Product is already ${status}` });
        return;
      }

      const updated = await this.products.updateStatus(productId, storeId, status);
      res.status(200).json({
        success: true,
        data: toAdminProductSummaryDTO(updated),
      });
    } catch (error) {
      logError('admin_product_status_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update product status' });
    }
  }
}
