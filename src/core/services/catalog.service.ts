/**
 * Catalog Services
 * Product, Category, and Inventory business logic
 *
 * Phase 4: Catalog Domain
 */

import { ProductEntity } from '../entities/product.entity';
import { CategoryEntity } from '../entities/category.entity';
import { ProductVariantEntity } from '../entities/product-variant.entity';
import { InventoryEntity } from '../entities/inventory.entity';
import { ProductImageEntity } from '../entities/product-image.entity';
import { ProductRepository } from '../repositories/product.repository';
import {
  CategoryRepository,
  VariantRepository,
  InventoryRepository,
  ProductImageRepository,
} from '../repositories/catalog.repositories';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateVariantDto,
  UpdateVariantDto,
  CreateProductImageDto,
  UpdateProductImageDto,
} from '../dtos/catalog.dto';

/**
 * Product Service
 */
export class ProductService {
  constructor(
    private productRepo: ProductRepository,
    private variantRepo: VariantRepository,
    private imageRepo: ProductImageRepository
  ) {}

  async createProduct(storeId: string, dto: CreateProductDto): Promise<ProductEntity> {
    // Check slug uniqueness
    const slugExists = await this.productRepo.slugExists(dto.slug, storeId);
    if (slugExists) {
      throw new Error(`Slug "${dto.slug}" already exists for this store`);
    }

    const product = new ProductEntity();
    product.store_id = storeId;
    product.name = dto.name;
    product.slug = dto.slug;
    product.description = dto.description || null;
    product.sku = dto.sku || null;
    product.status = dto.status || 'draft';
    product.is_featured = dto.is_featured || false;
    product.display_order = dto.display_order || 0;
    product.metadata = dto.metadata || {};
    product.created_by = dto.created_by || null;
    product.created_at = new Date();
    product.updated_at = new Date();

    return this.productRepo.save(product);
  }

  async updateProduct(storeId: string, productId: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const product = await this.productRepo.findByIdOrFail(productId, storeId);

    // Check slug uniqueness if changing slug
    if (dto.slug && dto.slug !== product.slug) {
      const slugExists = await this.productRepo.slugExists(dto.slug, storeId, productId);
      if (slugExists) {
        throw new Error(`Slug "${dto.slug}" already exists for this store`);
      }
    }

    if (dto.name) product.name = dto.name;
    if (dto.slug) product.slug = dto.slug;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.sku) product.sku = dto.sku;
    if (dto.status) product.status = dto.status;
    if (dto.is_featured !== undefined) product.is_featured = dto.is_featured;
    if (dto.display_order !== undefined) product.display_order = dto.display_order;
    if (dto.metadata) product.metadata = { ...product.metadata, ...dto.metadata };
    product.updated_at = new Date();

    return this.productRepo.save(product);
  }

  async getProduct(storeId: string, productId: string): Promise<ProductEntity> {
    return this.productRepo.findByIdOrFail(productId, storeId);
  }

  async listProducts(storeId: string, limit = 50, offset = 0): Promise<ProductEntity[]> {
    return this.productRepo.findActive(storeId, limit, offset);
  }

  async searchProducts(storeId: string, query: string, limit = 20): Promise<ProductEntity[]> {
    return this.productRepo.search(query, storeId, limit);
  }

  async deleteProduct(storeId: string, productId: string): Promise<void> {
    const product = await this.productRepo.findByIdOrFail(productId, storeId);
    product.deleted_at = new Date();
    await this.productRepo.save(product);
  }
}

/**
 * Category Service
 */
export class CategoryService {
  constructor(private categoryRepo: CategoryRepository) {}

  async createCategory(storeId: string, dto: CreateCategoryDto): Promise<CategoryEntity> {
    // Check slug uniqueness
    const slugExists = await this.categoryRepo.slugExists(dto.slug, storeId);
    if (slugExists) {
      throw new Error(`Slug "${dto.slug}" already exists for this store`);
    }

    // Validate parent category if provided
    if (dto.parent_category_id) {
      const parent = await this.categoryRepo.findByIdOrFail(dto.parent_category_id, storeId);
      if (parent.deleted_at) {
        throw new Error('Parent category is deleted');
      }
    }

    const category = new CategoryEntity();
    category.store_id = storeId;
    category.name = dto.name;
    category.slug = dto.slug;
    category.description = dto.description || null;
    category.parent_category_id = dto.parent_category_id || null;
    category.display_order = dto.display_order || 0;
    category.is_active = dto.is_active !== false;
    category.metadata = dto.metadata || {};
    category.created_at = new Date();
    category.updated_at = new Date();

    return this.categoryRepo.save(category);
  }

  async updateCategory(storeId: string, categoryId: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findByIdOrFail(categoryId, storeId);

    // Check slug uniqueness if changing slug
    if (dto.slug && dto.slug !== category.slug) {
      const slugExists = await this.categoryRepo.slugExists(dto.slug, storeId, categoryId);
      if (slugExists) {
        throw new Error(`Slug "${dto.slug}" already exists for this store`);
      }
    }

    if (dto.name) category.name = dto.name;
    if (dto.slug) category.slug = dto.slug;
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.parent_category_id !== undefined) {
      if (dto.parent_category_id) {
        const parent = await this.categoryRepo.findByIdOrFail(dto.parent_category_id, storeId);
        if (parent.deleted_at) {
          throw new Error('Parent category is deleted');
        }
      }
      category.parent_category_id = dto.parent_category_id;
    }
    if (dto.display_order !== undefined) category.display_order = dto.display_order;
    if (dto.is_active !== undefined) category.is_active = dto.is_active;
    if (dto.metadata) category.metadata = { ...category.metadata, ...dto.metadata };
    category.updated_at = new Date();

    return this.categoryRepo.save(category);
  }

  async getCategory(storeId: string, categoryId: string): Promise<CategoryEntity> {
    return this.categoryRepo.findByIdOrFail(categoryId, storeId);
  }

  async getRootCategories(storeId: string): Promise<CategoryEntity[]> {
    return this.categoryRepo.getRootCategories(storeId);
  }

  async getChildCategories(storeId: string, parentId: string): Promise<CategoryEntity[]> {
    return this.categoryRepo.getChildren(parentId, storeId);
  }

  async deleteCategory(storeId: string, categoryId: string): Promise<void> {
    const category = await this.categoryRepo.findByIdOrFail(categoryId, storeId);
    category.deleted_at = new Date();
    await this.categoryRepo.save(category);
  }
}

/**
 * Inventory Service
 */
export class InventoryService {
  constructor(private inventoryRepo: InventoryRepository) {}

  async createInventory(storeId: string, variantId: string, variantStoreId: string): Promise<InventoryEntity> {
    // Check if inventory already exists
    const existing = await this.inventoryRepo.findByVariantId(variantId, storeId);
    if (existing) {
      throw new Error('Inventory already exists for this variant');
    }

    const inventory = new InventoryEntity();
    inventory.variant_id = variantId;
    inventory.store_id = storeId;
    inventory.quantity_available = 0;
    inventory.quantity_reserved = 0;
    inventory.reorder_level = 0;
    inventory.reorder_quantity = 0;
    inventory.created_at = new Date();
    inventory.updated_at = new Date();

    return this.inventoryRepo.save(inventory);
  }

  async getInventory(storeId: string, variantId: string): Promise<InventoryEntity> {
    const inventory = await this.inventoryRepo.findByVariantId(variantId, storeId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }
    return inventory;
  }

  async checkStock(storeId: string, variantId: string, quantity: number): Promise<boolean> {
    return this.inventoryRepo.checkStock(variantId, storeId, quantity);
  }

  async reserveStock(storeId: string, variantId: string, quantity: number): Promise<void> {
    return this.inventoryRepo.reserveStock(variantId, storeId, quantity);
  }

  async releaseStock(storeId: string, variantId: string, quantity: number): Promise<void> {
    return this.inventoryRepo.releaseStock(variantId, storeId, quantity);
  }

  async getLowStockItems(storeId: string): Promise<InventoryEntity[]> {
    return this.inventoryRepo.getLowStock(storeId);
  }

  async updateReorderLevels(
    storeId: string,
    variantId: string,
    reorderLevel: number,
    reorderQuantity: number
  ): Promise<InventoryEntity> {
    const inventory = await this.getInventory(storeId, variantId);

    inventory.reorder_level = reorderLevel;
    inventory.reorder_quantity = reorderQuantity;
    inventory.updated_at = new Date();

    return this.inventoryRepo.save(inventory);
  }
}
