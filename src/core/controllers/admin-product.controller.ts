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
import { v4 as uuid } from 'uuid';
import { DataSource } from 'typeorm';
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

/**
 * Generate URL-safe slug from product name.
 * Preserves existing behavior of lowercasing, replacing spaces with hyphens,
 * and removing special characters.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export class AdminProductController {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
    private readonly inventory: InventoryRepository,
    private readonly images: ProductImageRepository,
    private readonly categories: CategoryRepository,
    private readonly dataSource?: DataSource,
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

  /** POST /products — Create a new product */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { name, description, sku, status, isFeatured, categoryId } = req.body ?? {};

      // Validation
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: 'Product name is required' });
        return;
      }

      const trimmedName = name.trim();
      if (trimmedName.length > 255) {
        res.status(400).json({ success: false, error: 'Product name must be 255 characters or less' });
        return;
      }

      const trimmedSku = sku ? String(sku).trim() : null;
      if (trimmedSku && trimmedSku.length > 100) {
        res.status(400).json({ success: false, error: 'SKU must be 100 characters or less' });
        return;
      }

      // Check SKU uniqueness if provided
      if (trimmedSku) {
        const existing = await this.products.findBySku(trimmedSku, storeId);
        if (existing) {
          res.status(409).json({ success: false, error: 'SKU already exists' });
          return;
        }
      }

      const productStatus = (status || 'draft') as ProductStatus;
      if (!VALID_STATUS.includes(productStatus)) {
        res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUS.join(', ')}` });
        return;
      }

      // Generate slug from name
      const slug = generateSlug(trimmedName);

      // Check slug uniqueness
      const slugExists = await this.products.slugExists(slug, storeId);
      if (slugExists) {
        res.status(409).json({ success: false, error: 'A product with this name already exists' });
        return;
      }

      const productId = uuid();
      const product = await this.products.createProduct(productId, storeId, {
        name: trimmedName,
        slug,
        description: description ? String(description).trim() : undefined,
        sku: trimmedSku || undefined,
        status: productStatus,
        isFeatured: Boolean(isFeatured),
        categoryId: categoryId ? String(categoryId) : undefined,
      });

      res.status(201).json({
        success: true,
        data: toAdminProductSummaryDTO(product),
      });
    } catch (error) {
      logError('admin_product_create_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to create product' });
    }
  }

  /** PATCH /products/:productId — Update product */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const { name, description, sku, status, isFeatured, categoryId } = req.body ?? {};

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      // Validation of changes
      const updates: Partial<{
        name: string;
        description: string | null;
        sku: string | null;
        status: string;
        isFeatured: boolean;
        categoryId: string | null;
      }> = {};

      if (name !== undefined) {
        const trimmed = String(name).trim();
        if (!trimmed) {
          res.status(400).json({ success: false, error: 'Product name cannot be empty' });
          return;
        }
        if (trimmed.length > 255) {
          res.status(400).json({ success: false, error: 'Product name must be 255 characters or less' });
          return;
        }
        updates.name = trimmed;
      }

      if (description !== undefined) {
        updates.description = description ? String(description).trim() : null;
      }

      if (sku !== undefined) {
        const trimmedSku = sku ? String(sku).trim() : null;
        if (trimmedSku && trimmedSku.length > 100) {
          res.status(400).json({ success: false, error: 'SKU must be 100 characters or less' });
          return;
        }
        // Check SKU uniqueness (excluding self)
        if (trimmedSku && trimmedSku !== product.sku) {
          const existing = await this.products.findBySku(trimmedSku, storeId);
          if (existing && existing.id !== productId) {
            res.status(409).json({ success: false, error: 'SKU already exists' });
            return;
          }
        }
        updates.sku = trimmedSku;
      }

      if (status !== undefined) {
        if (!VALID_STATUS.includes(status as ProductStatus)) {
          res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUS.join(', ')}` });
          return;
        }
        updates.status = status;
      }

      if (isFeatured !== undefined) {
        updates.isFeatured = Boolean(isFeatured);
      }

      if (categoryId !== undefined) {
        updates.categoryId = categoryId ? String(categoryId) : null;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ success: false, error: 'No changes provided' });
        return;
      }

      const updated = await this.products.updateProduct(productId, storeId, updates);
      const rollups = await this.products.rollupsFor(storeId, [productId]);

      res.status(200).json({
        success: true,
        data: toAdminProductSummaryDTO(updated, rollups.get(productId)),
      });
    } catch (error) {
      logError('admin_product_update_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update product' });
    }
  }

  /** DELETE /products/:productId — Delete product (soft delete) */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      // Soft delete the product
      await this.products.deleteProduct(productId, storeId);

      // Also soft delete all variants for consistency
      if (this.dataSource) {
        await this.dataSource.query(
          `UPDATE product_variants SET deleted_at = NOW(), updated_at = NOW()
           WHERE product_id = $1 AND store_id = $2 AND deleted_at IS NULL`,
          [productId, storeId],
        );
      }

      res.status(200).json({
        success: true,
        data: { id: productId, deleted: true },
      });
    } catch (error) {
      logError('admin_product_delete_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
  }

  /** POST /products/:productId/variants — Create variant */
  async createVariant(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const { sku, name, price, cost, weight, attributes, status } = req.body ?? {};

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      // Validation
      if (!sku || typeof sku !== 'string' || !sku.trim()) {
        res.status(400).json({ success: false, error: 'Variant SKU is required' });
        return;
      }

      const trimmedSku = sku.trim();
      if (trimmedSku.length > 100) {
        res.status(400).json({ success: false, error: 'SKU must be 100 characters or less' });
        return;
      }

      // Check SKU uniqueness
      const existingSku = await this.variants.skuExists(trimmedSku, storeId);
      if (existingSku) {
        res.status(409).json({ success: false, error: 'SKU already exists' });
        return;
      }

      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: 'Variant name is required' });
        return;
      }

      const parsedPrice = parseFloat(String(price ?? 0));
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        res.status(400).json({ success: false, error: 'Price must be a non-negative number' });
        return;
      }

      const parsedCost = cost !== undefined && cost !== null ? parseFloat(String(cost)) : null;
      if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
        res.status(400).json({ success: false, error: 'Cost must be a non-negative number' });
        return;
      }

      const variantId = uuid();
      const variantStatus = (status || 'active') as string;

      await this.variants.createVariant(variantId, productId, storeId, {
        sku: trimmedSku,
        name: name.trim(),
        price: parsedPrice,
        cost: parsedCost,
        weight: weight ? parseFloat(String(weight)) : null,
        attributes: (attributes ?? {}) as Record<string, string>,
        status: variantStatus,
      });

      const inventoryId = uuid();
      await this.inventory.createInventory(inventoryId, variantId, storeId);

      const variant = await this.variants.findOneScoped(variantId, storeId);

      const inv = await this.inventory.findByVariantId(variantId, storeId);
      if (!variant) {
        res.status(500).json({ success: false, error: 'Failed to create variant' });
        return;
      }

      res.status(201).json({
        success: true,
        data: toAdminVariantDTO(variant, inv),
      });
    } catch (error) {
      logError('admin_variant_create_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to create variant' });
    }
  }

  /** PATCH /products/:productId/variants/:variantId — Update variant */
  async updateVariant(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId, variantId } = req.params;
      const { sku, name, price, cost, weight, attributes, status } = req.body ?? {};

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const variant = await this.variants.findOneScoped(variantId, storeId);
      if (!variant || variant.product_id !== productId) {
        res.status(404).json({ success: false, error: 'Variant not found' });
        return;
      }

      const updates: Record<string, any> = {};

      if (sku !== undefined) {
        const trimmedSku = String(sku).trim();
        if (!trimmedSku) {
          res.status(400).json({ success: false, error: 'SKU cannot be empty' });
          return;
        }
        // Check uniqueness (excluding self)
        if (trimmedSku !== variant.sku) {
          const existingSku = await this.variants.skuExists(trimmedSku, storeId, variantId);
          if (existingSku) {
            res.status(409).json({ success: false, error: 'SKU already exists' });
            return;
          }
        }
        updates.sku = trimmedSku;
      }

      if (name !== undefined) {
        const trimmed = String(name).trim();
        if (!trimmed) {
          res.status(400).json({ success: false, error: 'Variant name cannot be empty' });
          return;
        }
        updates.name = trimmed;
      }

      if (price !== undefined) {
        const parsed = parseFloat(String(price));
        if (!Number.isFinite(parsed) || parsed < 0) {
          res.status(400).json({ success: false, error: 'Price must be a non-negative number' });
          return;
        }
        updates.price = parsed;
      }

      if (cost !== undefined) {
        if (cost === null) {
          updates.cost = null;
        } else {
          const parsed = parseFloat(String(cost));
          if (!Number.isFinite(parsed) || parsed < 0) {
            res.status(400).json({ success: false, error: 'Cost must be a non-negative number' });
            return;
          }
          updates.cost = parsed;
        }
      }

      if (weight !== undefined) {
        if (weight === null) {
          updates.weight = null;
        } else {
          const parsed = parseFloat(String(weight));
          if (!Number.isFinite(parsed) || parsed < 0) {
            res.status(400).json({ success: false, error: 'Weight must be a non-negative number' });
            return;
          }
          updates.weight = parsed;
        }
      }

      if (attributes !== undefined) {
        updates.attributes = attributes ?? {};
      }

      if (status !== undefined) {
        updates.status = status;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ success: false, error: 'No changes provided' });
        return;
      }

      updates.updated_at = new Date();

      await this.variants.updateVariant(variantId, storeId, updates);

      const updated = await this.variants.findOneScoped(variantId, storeId);

      const inv = await this.inventory.findByVariantId(variantId, storeId);

      if (!updated) {
        res.status(500).json({ success: false, error: 'Failed to update variant' });
        return;
      }

      res.status(200).json({
        success: true,
        data: toAdminVariantDTO(updated, inv),
      });
    } catch (error) {
      logError('admin_variant_update_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update variant' });
    }
  }

  /** DELETE /products/:productId/variants/:variantId — Delete variant */
  async deleteVariant(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId, variantId } = req.params;

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const variant = await this.variants.findOneScoped(variantId, storeId);
      if (!variant || variant.product_id !== productId) {
        res.status(404).json({ success: false, error: 'Variant not found' });
        return;
      }

      await this.variants.updateVariant(variantId, storeId, {
        deleted_at: new Date(),
        updated_at: new Date(),
      });

      res.status(200).json({
        success: true,
        data: { id: variantId, deleted: true },
      });
    } catch (error) {
      logError('admin_variant_delete_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to delete variant' });
    }
  }

  /** PATCH /products/:productId/inventory/:variantId — Adjust inventory */
  async adjustInventory(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId, variantId } = req.params;
      const { quantityAvailable, reorderLevel, reorderQuantity } = req.body ?? {};

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const variant = await this.variants.findOneScoped(variantId, storeId);
      if (!variant || variant.product_id !== productId) {
        res.status(404).json({ success: false, error: 'Variant not found' });
        return;
      }

      const inventory = await this.inventory.findByVariantId(variantId, storeId);
      if (!inventory) {
        res.status(404).json({ success: false, error: 'Inventory not found' });
        return;
      }

      const updates: Record<string, any> = {};

      if (quantityAvailable !== undefined) {
        const parsed = parseIntOr(quantityAvailable, -1);
        if (parsed < 0) {
          res.status(400).json({ success: false, error: 'Quantity must be non-negative' });
          return;
        }
        updates.quantity_available = parsed;
      }

      if (reorderLevel !== undefined) {
        const parsed = parseIntOr(reorderLevel, -1);
        if (parsed < 0) {
          res.status(400).json({ success: false, error: 'Reorder level must be non-negative' });
          return;
        }
        updates.reorder_level = parsed;
      }

      if (reorderQuantity !== undefined) {
        const parsed = parseIntOr(reorderQuantity, -1);
        if (parsed < 0) {
          res.status(400).json({ success: false, error: 'Reorder quantity must be non-negative' });
          return;
        }
        updates.reorder_quantity = parsed;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ success: false, error: 'No changes provided' });
        return;
      }

      updates.updated_at = new Date();

      await this.inventory.updateInventory(variantId, storeId, updates);

      const updated = await this.inventory.findByVariantId(variantId, storeId);

      res.status(200).json({
        success: true,
        data: toAdminVariantDTO(variant, updated),
      });
    } catch (error) {
      logError('admin_inventory_adjust_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to adjust inventory' });
    }
  }

  /** GET /products/:productId/images — List images */
  async listImages(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const images = await this.images.findByProductId(productId, storeId);

      res.status(200).json({
        success: true,
        data: images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.alt_text ?? null,
          displayOrder: img.display_order,
          isPrimary: img.is_primary,
        })),
      });
    } catch (error) {
      logError('admin_images_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to list images' });
    }
  }

  /** POST /products/:productId/images — Add image(s) */
  async addImage(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const { url, altText } = req.body ?? {};

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({ success: false, error: 'Image URL is required' });
        return;
      }

      // Get next display order
      const existing = await this.images.findByProductId(productId, storeId);
      const nextOrder = existing.length;

      const imageId = uuid();
      const isPrimary = existing.length === 0;
      const image = await this.images.createImage(
        imageId,
        productId,
        storeId,
        url.trim(),
        altText ? String(altText).trim() : null,
        nextOrder,
        isPrimary,
      );

      if (!image) {
        res.status(500).json({ success: false, error: 'Failed to create image' });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          id: image.id,
          url: image.url,
          altText: image.alt_text ?? null,
          displayOrder: image.display_order,
          isPrimary: image.is_primary,
        },
      });
    } catch (error) {
      logError('admin_image_add_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to add image' });
    }
  }

  /** DELETE /products/:productId/images/:imageId — Delete image */
  async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId, imageId } = req.params;

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const image = await this.images.findOneScoped(imageId, productId, storeId);
      if (!image) {
        res.status(404).json({ success: false, error: 'Image not found' });
        return;
      }

      if (image.is_primary) {
        const remaining = await this.images.findByProductId(productId, storeId);
        const next = remaining.find((img) => img.id !== imageId);
        if (next) {
          await this.images.setPrimaryImage(next.id, productId, storeId);
        }
      }

      await this.images.deleteImage(imageId, storeId);

      res.status(200).json({
        success: true,
        data: { id: imageId, deleted: true },
      });
    } catch (error) {
      logError('admin_image_delete_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to delete image' });
    }
  }

  /** PATCH /products/:productId/images/:imageId/primary — Set as primary image */
  async setPrimaryImage(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId, imageId } = req.params;

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      const image = await this.images.findOneScoped(imageId, productId, storeId);
      if (!image) {
        res.status(404).json({ success: false, error: 'Image not found' });
        return;
      }

      await this.images.setPrimaryImage(imageId, productId, storeId);

      const updated = await this.images.findOneScoped(imageId, productId, storeId);

      res.status(200).json({
        success: true,
        data: {
          id: updated!.id,
          url: updated!.url,
          altText: updated!.alt_text ?? null,
          displayOrder: updated!.display_order,
          isPrimary: updated!.is_primary,
        },
      });
    } catch (error) {
      logError('admin_image_primary_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to set primary image' });
    }
  }

  /** PATCH /products/:productId/images/reorder — Reorder images */
  async reorderImages(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const { order } = req.body ?? {};

      const product = await this.products.findOneScoped(productId, storeId);
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      if (!Array.isArray(order)) {
        res.status(400).json({ success: false, error: 'Order must be an array' });
        return;
      }

      for (const item of order) {
        const image = await this.images.findOneScoped(item.id, productId, storeId);
        if (!image) {
          res.status(404).json({ success: false, error: `Image ${item.id} not found` });
          return;
        }
      }

      await this.images.reorderImages(productId, storeId, order);

      const images = await this.images.findByProductId(productId, storeId);

      res.status(200).json({
        success: true,
        data: images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.alt_text ?? null,
          displayOrder: img.display_order,
          isPrimary: img.is_primary,
        })),
      });
    } catch (error) {
      logError('admin_images_reorder_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to reorder images' });
    }
  }
}
