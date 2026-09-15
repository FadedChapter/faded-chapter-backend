/**
 * Product Repository
 * Catalog product management with store isolation
 *
 * Phase 4: Catalog Domain
 */

import { BaseRepository } from '../repository/base-repository';
import { ProductEntity } from '../entities/product.entity';

export class ProductRepository extends BaseRepository<ProductEntity> {
  constructor() {
    super(ProductEntity);
  }

  /**
   * Find product by slug (scoped to store)
   */
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

      await this.repository.update(
        { id: productId, store_id: storeId } as any,
        { display_order: product.display_order + 1, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to increment display order: ${(error as Error).message}`);
    }
  }
}
