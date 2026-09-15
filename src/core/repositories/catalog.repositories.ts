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
}
