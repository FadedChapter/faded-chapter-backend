/**
 * Catalog Repositories
 * Category, Variant, Inventory, and Image repositories
 *
 * Phase 4: Catalog Domain
 */

import { BaseRepository } from '../repository/base-repository';
import { CategoryEntity } from '../entities/category.entity';
import { ProductVariantEntity } from '../entities/product-variant.entity';
import { InventoryEntity } from '../entities/inventory.entity';
import { ProductImageEntity } from '../entities/product-image.entity';

/**
 * Category Repository
 */
export class CategoryRepository extends BaseRepository<CategoryEntity> {
  constructor() {
    super(CategoryEntity);
  }

  async findBySlug(slug: string, storeId: string): Promise<CategoryEntity | null> {
    return this.repository.findOne({
      where: { slug, store_id: storeId } as any,
    });
  }

  async getRootCategories(storeId: string): Promise<CategoryEntity[]> {
    return this.repository.find({
      where: { store_id: storeId, parent_category_id: null } as any,
      order: { display_order: 'ASC' } as any,
    });
  }

  async getChildren(parentId: string, storeId: string): Promise<CategoryEntity[]> {
    return this.repository.find({
      where: { parent_category_id: parentId, store_id: storeId } as any,
      order: { display_order: 'ASC' } as any,
    });
  }

  async getActive(storeId: string): Promise<CategoryEntity[]> {
    return this.repository.find({
      where: { store_id: storeId, is_active: true } as any,
      order: { display_order: 'ASC' } as any,
    });
  }
}

/**
 * Product Variant Repository
 */
export class VariantRepository extends BaseRepository<ProductVariantEntity> {
  constructor() {
    super(ProductVariantEntity);
  }

  async findByProductId(productId: string, storeId: string): Promise<ProductVariantEntity[]> {
    return this.repository.find({
      where: { product_id: productId, store_id: storeId } as any,
      order: { display_order: 'ASC' } as any,
    });
  }

  async findBySku(sku: string, storeId: string): Promise<ProductVariantEntity | null> {
    return this.repository.findOne({
      where: { sku, store_id: storeId } as any,
    });
  }

  async skuExists(sku: string, storeId: string, excludeVariantId?: string): Promise<boolean> {
    let query = this.repository
      .createQueryBuilder('v')
      .where('v.store_id = :storeId', { storeId })
      .andWhere('v.sku = :sku', { sku });

    if (excludeVariantId) {
      query = query.andWhere('v.id != :excludeVariantId', { excludeVariantId });
    }

    return (await query.getCount()) > 0;
  }

  async getActive(productId: string, storeId: string): Promise<ProductVariantEntity[]> {
    return this.repository.find({
      where: { product_id: productId, store_id: storeId, status: 'active' } as any,
      order: { display_order: 'ASC' } as any,
    });
  }

  async createVariant(
    id: string,
    productId: string,
    storeId: string,
    data: {
      sku: string;
      name: string;
      price: number;
      cost: number | null;
      weight: number | null;
      attributes: Record<string, string>;
      status: string;
    },
  ): Promise<ProductVariantEntity> {
    const variant = this.repository.create({
      id,
      product_id: productId,
      store_id: storeId,
      sku: data.sku,
      name: data.name,
      price: data.price,
      cost: data.cost,
      weight: data.weight,
      attributes: data.attributes,
      status: data.status,
    } as any);
    await this.repository.save(variant);
    return variant;
  }

  async updateVariant(
    id: string,
    storeId: string,
    updates: Record<string, any>,
  ): Promise<void> {
    await this.repository.update(
      { id, store_id: storeId } as any,
      updates,
    );
  }

  async findOneScoped(id: string, storeId: string): Promise<ProductVariantEntity | null> {
    return this.repository.findOne({
      where: { id, store_id: storeId } as any,
    });
  }
}

/**
 * Inventory Repository
 */
export class InventoryRepository extends BaseRepository<InventoryEntity> {
  constructor() {
    super(InventoryEntity);
  }

  async findByVariantId(variantId: string, storeId: string): Promise<InventoryEntity | null> {
    return this.repository.findOne({
      where: { variant_id: variantId, store_id: storeId } as any,
    });
  }

  async checkStock(variantId: string, storeId: string, quantity: number): Promise<boolean> {
    const inventory = await this.findByVariantId(variantId, storeId);
    return inventory ? inventory.quantity_available >= quantity : false;
  }

  async reserveStock(variantId: string, storeId: string, quantity: number): Promise<void> {
    const inventory = await this.findByVariantId(variantId, storeId);
    if (!inventory) throw new Error('Inventory not found');
    if (inventory.quantity_available < quantity) throw new Error('Insufficient stock');

    await this.repository.update(
      { variant_id: variantId, store_id: storeId } as any,
      {
        quantity_available: inventory.quantity_available - quantity,
        quantity_reserved: inventory.quantity_reserved + quantity,
        updated_at: new Date(),
      }
    );
  }

  async releaseStock(variantId: string, storeId: string, quantity: number): Promise<void> {
    const inventory = await this.findByVariantId(variantId, storeId);
    if (!inventory) throw new Error('Inventory not found');

    await this.repository.update(
      { variant_id: variantId, store_id: storeId } as any,
      {
        quantity_available: inventory.quantity_available + quantity,
        quantity_reserved: Math.max(0, inventory.quantity_reserved - quantity),
        updated_at: new Date(),
      }
    );
  }

  async getLowStock(storeId: string): Promise<InventoryEntity[]> {
    return this.repository
      .createQueryBuilder('i')
      .where('i.store_id = :storeId', { storeId })
      .andWhere('i.quantity_available <= i.reorder_level')
      .getMany();
  }

  // ==========================================================================
  // Operations console (Phase 4)
  // ==========================================================================

  /**
   * Stock list for the inventory console.
   *
   * Joins variant and product because inventory rows are meaningless on their
   * own — an operator searches by SKU or product name, not by variant uuid.
   * Returns raw rows rather than entities: the console needs a flat row shape
   * spanning three tables, and hydrating entity graphs to then flatten them
   * would cost more for no benefit.
   *
   * store_id is applied unconditionally as the first predicate.
   */
  async searchStock(
    storeId: string,
    options: {
      /** 'low' = at or below reorder level; 'out' = nothing sellable. */
      filter?: 'all' | 'low' | 'out';
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ rows: InventoryStockRow[]; total: number }> {
    const { filter = 'all', search, limit = 25, offset = 0 } = options;

    const qb = this.repository
      .createQueryBuilder('i')
      .innerJoin('product_variants', 'v', 'v.id = i.variant_id')
      .innerJoin('products', 'p', 'p.id = v.product_id')
      .where('i.store_id = :storeId', { storeId });

    if (filter === 'low') {
      // At or below the reorder threshold but not yet empty — the set worth
      // acting on. Out-of-stock is past acting on and has its own filter.
      qb.andWhere('i.quantity_available <= i.reorder_level').andWhere(
        'i.quantity_available > 0',
      );
    } else if (filter === 'out') {
      qb.andWhere('i.quantity_available <= 0');
    }

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(v.sku ILIKE :term OR p.name ILIKE :term)', { term });
    }

    const total = await qb.getCount();

    const rows = await qb
      .select([
        'i.id AS id',
        'i.variant_id AS "variantId"',
        'v.sku AS sku',
        'v.name AS "variantName"',
        'p.id AS "productId"',
        'p.name AS "productName"',
        'p.status AS "productStatus"',
        'i.quantity_available AS available',
        'i.quantity_reserved AS reserved',
        'i.reorder_level AS "reorderLevel"',
        'i.reorder_quantity AS "reorderQuantity"',
        'i.last_counted_at AS "lastCountedAt"',
        'i.updated_at AS "updatedAt"',
      ])
      // Scarcest first: the console's job is to surface what needs attention,
      // so the default order is the work queue rather than alphabetical.
      .orderBy('i.quantity_available', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0))
      .getRawMany<InventoryStockRow>();

    return { rows, total };
  }

  /**
   * One joined stock row by variant.
   * Used after a mutation so the response can name the SKU and product without
   * the client making a second call.
   */
  async findStockRow(variantId: string, storeId: string): Promise<InventoryStockRow | null> {
    const row = await this.repository
      .createQueryBuilder('i')
      .innerJoin('product_variants', 'v', 'v.id = i.variant_id')
      .innerJoin('products', 'p', 'p.id = v.product_id')
      .where('i.store_id = :storeId', { storeId })
      .andWhere('i.variant_id = :variantId', { variantId })
      .select([
        'i.id AS id',
        'i.variant_id AS "variantId"',
        'v.sku AS sku',
        'v.name AS "variantName"',
        'p.id AS "productId"',
        'p.name AS "productName"',
        'p.status AS "productStatus"',
        'i.quantity_available AS available',
        'i.quantity_reserved AS reserved',
        'i.reorder_level AS "reorderLevel"',
        'i.reorder_quantity AS "reorderQuantity"',
        'i.last_counted_at AS "lastCountedAt"',
        'i.updated_at AS "updatedAt"',
      ])
      .getRawOne<InventoryStockRow>();

    return row ?? null;
  }

  /** Counts for the console's tabs, in one round trip. */
  async stockCounts(storeId: string): Promise<{ all: number; low: number; out: number }> {
    const row = await this.repository
      .createQueryBuilder('i')
      .select('COUNT(*)', 'all')
      .addSelect(
        'COUNT(*) FILTER (WHERE i.quantity_available <= i.reorder_level AND i.quantity_available > 0)',
        'low',
      )
      .addSelect('COUNT(*) FILTER (WHERE i.quantity_available <= 0)', 'out')
      .where('i.store_id = :storeId', { storeId })
      .getRawOne<{ all: string; low: string; out: string }>();

    return {
      all: Number(row?.all ?? 0),
      low: Number(row?.low ?? 0),
      out: Number(row?.out ?? 0),
    };
  }

  /**
   * Apply a stock adjustment atomically.
   *
   * The arithmetic happens in SQL rather than in JS. reserveStock and
   * releaseStock above read-then-write without a transaction, which loses
   * updates under concurrency: two simultaneous reserves both read
   * available=5, both write 5-3=2, and six units get committed from five.
   * Adjustments are an operator correcting the books, so they must not be
   * capable of introducing the very drift they exist to fix.
   *
   * Returns null when the guard rejects the write — either the row does not
   * belong to this store, or the delta would drive available stock negative.
   */
  async adjustStock(
    variantId: string,
    storeId: string,
    delta: number,
  ): Promise<InventoryEntity | null> {
    const result = await this.repository
      .createQueryBuilder()
      .update(InventoryEntity)
      .set({
        quantity_available: () => 'quantity_available + :delta',
        last_counted_at: new Date(),
        updated_at: new Date(),
      } as any)
      .where('variant_id = :variantId', { variantId })
      .andWhere('store_id = :storeId', { storeId })
      // Floor guard in the same statement as the write, so it cannot be
      // raced between a check and an update.
      .andWhere('quantity_available + :delta >= 0')
      .setParameter('delta', delta)
      .execute();

    if (!result.affected) {
      return null;
    }
    return this.findByVariantId(variantId, storeId);
  }

  /** Set the reorder threshold and suggested reorder quantity. */
  async setReorderPolicy(
    variantId: string,
    storeId: string,
    reorderLevel: number,
    reorderQuantity: number,
  ): Promise<InventoryEntity | null> {
    const result = await this.repository.update(
      { variant_id: variantId, store_id: storeId } as any,
      {
        reorder_level: reorderLevel,
        reorder_quantity: reorderQuantity,
        updated_at: new Date(),
      } as any,
    );
    if (!result.affected) {
      return null;
    }
    return this.findByVariantId(variantId, storeId);
  }

  async createInventory(
    id: string,
    variantId: string,
    storeId: string,
  ): Promise<InventoryEntity> {
    const inventory = this.repository.create({
      id,
      variant_id: variantId,
      store_id: storeId,
      quantity_available: 0,
      quantity_reserved: 0,
      reorder_level: 0,
      reorder_quantity: 0,
    } as any);
    await this.repository.save(inventory);
    return inventory;
  }

  async updateInventory(
    variantId: string,
    storeId: string,
    updates: Record<string, any>,
  ): Promise<void> {
    await this.repository.update(
      { variant_id: variantId, store_id: storeId } as any,
      updates,
    );
  }
}

/** Flat row spanning inventory + variant + product, for the console list. */
export interface InventoryStockRow {
  id: string;
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productName: string;
  productStatus: string;
  available: number;
  reserved: number;
  reorderLevel: number;
  reorderQuantity: number;
  lastCountedAt: Date | null;
  updatedAt: Date;
}

/**
 * Product Image Repository
 */
export class ProductImageRepository extends BaseRepository<ProductImageEntity> {
  constructor() {
    super(ProductImageEntity);
  }

  async findByProductId(productId: string, storeId: string): Promise<ProductImageEntity[]> {
    return this.repository.find({
      where: { product_id: productId, store_id: storeId } as any,
      order: { display_order: 'ASC', is_primary: 'DESC' } as any,
    });
  }

  async getPrimaryImage(productId: string, storeId: string): Promise<ProductImageEntity | null> {
    return this.repository.findOne({
      where: { product_id: productId, store_id: storeId, is_primary: true } as any,
    });
  }

  async setPrimaryImage(imageId: string, productId: string, storeId: string): Promise<void> {
    // Clear all primaries for this product
    await this.repository.update(
      { product_id: productId, store_id: storeId } as any,
      { is_primary: false }
    );

    // Set this one as primary
    await this.repository.update(
      { id: imageId, product_id: productId, store_id: storeId } as any,
      { is_primary: true }
    );
  }

  async reorderImages(productId: string, storeId: string, imageOrder: Array<{ id: string; order: number }>): Promise<void> {
    for (const item of imageOrder) {
      await this.repository.update(
        { id: item.id, product_id: productId, store_id: storeId } as any,
        { display_order: item.order }
      );
    }
  }

  async createImage(
    id: string,
    productId: string,
    storeId: string,
    url: string,
    altText: string | null,
    displayOrder: number,
    isPrimary: boolean,
  ): Promise<ProductImageEntity> {
    const image = this.repository.create({
      id,
      product_id: productId,
      store_id: storeId,
      url,
      alt_text: altText,
      display_order: displayOrder,
      is_primary: isPrimary,
    } as any);
    await this.repository.save(image);
    return image;
  }

  async findOneScoped(id: string, productId: string, storeId: string): Promise<ProductImageEntity | null> {
    return this.repository.findOne({
      where: { id, product_id: productId, store_id: storeId } as any,
    });
  }

  async deleteImage(id: string, storeId: string): Promise<void> {
    await this.repository.delete({ id, store_id: storeId } as any);
  }
}
