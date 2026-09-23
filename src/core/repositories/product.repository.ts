/**
 * Product Repository
 * Catalog product management with store isolation
 *
 * Phase 4: Catalog Domain
 */

import { IsNull } from 'typeorm';
import { BaseRepository } from '../repository/base-repository';
import { ProductEntity } from '../entities/product.entity';

export class ProductRepository extends BaseRepository<ProductEntity> {
  constructor() {
    super(ProductEntity);
  }

  /**
   * Catalogue search for the admin product list.
   *
   * The existing finders return only active products or a single status with no
   * total, which cannot express what catalogue management needs — drafts and
   * archived products are exactly what an operator is looking for when curating.
   * Soft-deleted rows stay excluded in every case.
   */
  async searchCatalogue(
    storeId: string,
    options: {
      status?: string;
      categoryId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ rows: ProductEntity[]; total: number }> {
    const { status, categoryId, search, limit = 25, offset = 0 } = options;

    const qb = this.repository
      .createQueryBuilder('p')
      .where('p.store_id = :storeId', { storeId })
      .andWhere('p.deleted_at IS NULL');

    if (status) qb.andWhere('p.status = :status', { status });
    if (categoryId) qb.andWhere('p.category_id = :categoryId', { categoryId });

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(p.name ILIKE :term OR p.sku ILIKE :term OR p.slug ILIKE :term)', { term });
    }

    qb.orderBy('p.display_order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .take(Math.min(Math.max(limit, 1), 100))
      .skip(Math.max(offset, 0));

    const [rows, total] = await qb.getManyAndCount();
    return { rows, total };
  }

  /** Product counts per status, for the catalogue tabs. */
  async countByStatuses(storeId: string): Promise<Record<string, number>> {
    const rows = await this.repository
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('p.store_id = :storeId', { storeId })
      .andWhere('p.deleted_at IS NULL')
      .groupBy('p.status')
      .getRawMany<{ status: string; count: string }>();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});
  }

  /**
   * Variant and stock rollups for a page of products.
   *
   * One aggregate over the page rather than loading every variant and its
   * inventory row: the list shows counts and a stock total, not the variants
   * themselves. `priceFrom` drives the "from ₹x" display.
   */
  async rollupsFor(
    storeId: string,
    productIds: string[],
  ): Promise<Map<string, { variantCount: number; stock: number; priceFrom: number | null }>> {
    const result = new Map<string, { variantCount: number; stock: number; priceFrom: number | null }>();
    if (productIds.length === 0) return result;

    const rows = await this.repository.manager
      .createQueryBuilder()
      .select('v.product_id', 'productId')
      .addSelect('COUNT(DISTINCT v.id)', 'variantCount')
      .addSelect('COALESCE(SUM(i.quantity_available), 0)', 'stock')
      .addSelect('MIN(v.price)', 'priceFrom')
      .from('product_variants', 'v')
      .leftJoin('inventory', 'i', 'i.variant_id = v.id AND i.store_id = v.store_id')
      .where('v.product_id IN (:...ids)', { ids: productIds })
      .andWhere('v.store_id = :storeId', { storeId })
      .andWhere('v.deleted_at IS NULL')
      .groupBy('v.product_id')
      .getRawMany<{ productId: string; variantCount: string; stock: string; priceFrom: string | null }>();

    for (const row of rows) {
      result.set(row.productId, {
        variantCount: Number(row.variantCount),
        stock: Number(row.stock),
        priceFrom: row.priceFrom === null ? null : Number(row.priceFrom),
      });
    }
    return result;
  }

  /**
   * Fetch one product scoped to its store, excluding soft-deleted rows.
   *
   * IsNull() rather than `deleted_at: null` — TypeORM rejects a literal null in
   * a where condition and throws rather than matching SQL NULL. The same
   * mistake currently breaks the storefront's category listing.
   */
  async findOneScoped(productId: string, storeId: string): Promise<ProductEntity | null> {
    return this.repository.findOne({
      where: { id: productId, store_id: storeId, deleted_at: IsNull() } as any,
    });
  }

  /** Find product by slug (scoped to store) */
  async findBySlug(slug: string, storeId: string): Promise<ProductEntity | null> {
    try {
      return await this.repository.findOne({
        where: {
          slug,
          store_id: storeId,
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to find product by slug: ${(error as Error).message}`);
    }
  }

  /**
   * Find product by SKU (scoped to store)
   */
  async findBySku(sku: string, storeId: string): Promise<ProductEntity | null> {
    try {
      return await this.repository.findOne({
        where: {
          sku,
          store_id: storeId,
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to find product by SKU: ${(error as Error).message}`);
    }
  }

  /**
   * List products by status (scoped to store)
   */
  async findByStatus(status: string, storeId: string, limit = 50, offset = 0): Promise<ProductEntity[]> {
    try {
      return await this.repository.find({
        where: {
          status,
          store_id: storeId,
        } as any,
        order: { display_order: 'ASC' } as any,
        skip: offset,
        take: limit,
      });
    } catch (error) {
      throw new Error(`Failed to find products by status: ${(error as Error).message}`);
    }
  }

  /**
   * List active products for store
   */
  async findActive(storeId: string, limit = 50, offset = 0): Promise<ProductEntity[]> {
    return this.findByStatus('active', storeId, limit, offset);
  }

  /**
   * Search products by name (scoped to store)
   */
  async search(query: string, storeId: string, limit = 20): Promise<ProductEntity[]> {
    try {
      const lowercaseQuery = `%${query.toLowerCase()}%`;
      return await this.repository
        .createQueryBuilder('p')
        .where('p.store_id = :storeId', { storeId })
        .andWhere('(LOWER(p.name) LIKE :query OR LOWER(p.description) LIKE :query)', { query: lowercaseQuery })
        .take(limit)
        .getMany();
    } catch (error) {
      throw new Error(`Failed to search products: ${(error as Error).message}`);
    }
  }

  /**
   * Get featured products
   */
  async getFeatured(storeId: string, limit = 10): Promise<ProductEntity[]> {
    try {
      return await this.repository.find({
        where: {
          store_id: storeId,
          is_featured: true,
          status: 'active',
        } as any,
        order: { display_order: 'ASC' } as any,
        take: limit,
      });
    } catch (error) {
      throw new Error(`Failed to get featured products: ${(error as Error).message}`);
    }
  }

  /**
   * Check slug uniqueness (for create/update)
   */
  async slugExists(slug: string, storeId: string, excludeProductId?: string): Promise<boolean> {
    try {
      let query = this.repository
        .createQueryBuilder('p')
        .where('p.store_id = :storeId', { storeId })
        .andWhere('p.slug = :slug', { slug });

      if (excludeProductId) {
        query = query.andWhere('p.id != :excludeProductId', { excludeProductId });
      }

      const result = await query.getCount();
      return result > 0;
    } catch (error) {
      throw new Error(`Failed to check slug uniqueness: ${(error as Error).message}`);
    }
  }

  /**
   * Update product status
   */
  async updateStatus(productId: string, storeId: string, status: string): Promise<ProductEntity> {
    try {
      await this.repository.update(
        { id: productId, store_id: storeId } as any,
        { status, updated_at: new Date() }
      );

      return this.findByIdOrFail(productId, storeId);
    } catch (error) {
      throw new Error(`Failed to update product status: ${(error as Error).message}`);
    }
  }

  /**
   * Increment display order
   */
  async incrementDisplayOrder(productId: string, storeId: string): Promise<void> {
    try {
      const product = await this.findByIdOrFail(productId, storeId);

      await this.update(productId, storeId, {
        display_order: product.display_order + 1,
      } as any);
    } catch (error) {
      throw new Error(`Failed to increment display order: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new product
   */
  async createProduct(
    productId: string,
    storeId: string,
    data: {
      name: string;
      slug: string;
      description?: string;
      sku?: string;
      status: string;
      isFeatured: boolean;
      categoryId?: string;
    },
  ): Promise<ProductEntity> {
    try {
      const product = this.repository.create({
        id: productId,
        store_id: storeId,
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        sku: data.sku ?? null,
        status: data.status,
        is_featured: data.isFeatured,
        category_id: data.categoryId ?? null,
      } as any) as unknown as ProductEntity;

      await this.repository.save(product);
      return product;
    } catch (error) {
      throw new Error(`Failed to create product: ${(error as Error).message}`);
    }
  }

  /**
   * Update product fields
   */
  async updateProduct(
    productId: string,
    storeId: string,
    data: Partial<{
      name: string;
      description: string | null;
      sku: string | null;
      status: string;
      isFeatured: boolean;
      categoryId: string | null;
    }>,
  ): Promise<ProductEntity> {
    try {
      const updates: any = { updated_at: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.sku !== undefined) updates.sku = data.sku;
      if (data.status !== undefined) updates.status = data.status;
      if (data.isFeatured !== undefined) updates.is_featured = data.isFeatured;
      if (data.categoryId !== undefined) updates.category_id = data.categoryId;

      await this.repository.update({ id: productId, store_id: storeId } as any, updates);
      return this.findByIdOrFail(productId, storeId);
    } catch (error) {
      throw new Error(`Failed to update product: ${(error as Error).message}`);
    }
  }

  /**
   * Soft delete a product
   */
  async deleteProduct(productId: string, storeId: string): Promise<void> {
    try {
      await this.softDelete(productId, storeId);
    } catch (error) {
      throw new Error(`Failed to delete product: ${(error as Error).message}`);
    }
  }
}
