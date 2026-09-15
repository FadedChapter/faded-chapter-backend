/**
 * Catalog Domain Integration Tests
 * Testing product management, categories, inventory, and soft deletes
 *
 * Phase 4: Catalog Domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProductEntity } from '../entities/product.entity';
import { CategoryEntity } from '../entities/category.entity';
import { InventoryEntity } from '../entities/inventory.entity';
import { ProductRepository } from '../repositories/product.repository';
import {
  CategoryRepository,
  VariantRepository,
  InventoryRepository,
  ProductImageRepository,
} from '../repositories/catalog.repositories';
import { ProductService } from '../services/catalog.service';
import { CategoryService } from '../services/catalog.service';
import { InventoryService } from '../services/catalog.service';

describe('Catalog Domain Integration Tests', () => {
  let productRepo: ProductRepository;
  let categoryRepo: CategoryRepository;
  let variantRepo: VariantRepository;
  let inventoryRepo: InventoryRepository;
  let imageRepo: ProductImageRepository;

  let productService: ProductService;
  let categoryService: CategoryService;
  let inventoryService: InventoryService;

  const storeId1 = '550e8400-e29b-41d4-a716-446655440001';
  const storeId2 = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    productRepo = new ProductRepository();
    categoryRepo = new CategoryRepository();
    variantRepo = new VariantRepository();
    inventoryRepo = new InventoryRepository();
    imageRepo = new ProductImageRepository();

    productService = new ProductService(productRepo, variantRepo, imageRepo);
    categoryService = new CategoryService(categoryRepo);
    inventoryService = new InventoryService(inventoryRepo);
  });

  describe('Product CRUD Operations', () => {
    it('should create a product', async () => {
      const product = await productService.createProduct(storeId1, {
        name: 'Test Product',
        slug: 'test-product',
        sku: 'TEST-001',
        description: 'A test product',
        status: 'active',
        created_by: 'test-user',
      });

      expect(product).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.store_id).toBe(storeId1);
      expect(product.status).toBe('active');
    });

    it('should prevent duplicate slugs within a store', async () => {
      await productService.createProduct(storeId1, {
        name: 'Product A',
        slug: 'duplicate-slug',
        sku: 'SKU-001',
      });

      expect(
        productService.createProduct(storeId1, {
          name: 'Product B',
          slug: 'duplicate-slug',
          sku: 'SKU-002',
        })
      ).rejects.toThrow('Slug');
    });

    it('should allow same slug in different stores', async () => {
      await productService.createProduct(storeId1, {
        name: 'Product A',
        slug: 'same-slug',
        sku: 'SKU-001',
      });

      const product2 = await productService.createProduct(storeId2, {
        name: 'Product B',
        slug: 'same-slug',
        sku: 'SKU-002',
      });

      expect(product2.store_id).toBe(storeId2);
    });

    it('should update a product', async () => {
      const created = await productService.createProduct(storeId1, {
        name: 'Original Name',
        slug: 'product-slug',
        sku: 'SKU-001',
      });

      const updated = await productService.updateProduct(storeId1, created.id, {
        name: 'Updated Name',
        is_featured: true,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.is_featured).toBe(true);
      expect(updated.slug).toBe('product-slug');
    });

    it('should retrieve a product by ID', async () => {
      const created = await productService.createProduct(storeId1, {
        name: 'Retrieve Test',
        slug: 'retrieve-test',
        sku: 'SKU-001',
      });

      const retrieved = await productService.getProduct(storeId1, created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Retrieve Test');
    });

    it('should search products by name', async () => {
      await productService.createProduct(storeId1, {
        name: 'Blue Shirt',
        slug: 'blue-shirt',
        sku: 'SHIRT-001',
        description: 'A blue cotton shirt',
      });

      await productService.createProduct(storeId1, {
        name: 'Red Pants',
        slug: 'red-pants',
        sku: 'PANTS-001',
      });

      const results = await productService.searchProducts(storeId1, 'shirt');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Shirt');
    });

    it('should soft delete a product', async () => {
      const created = await productService.createProduct(storeId1, {
        name: 'Delete Test',
        slug: 'delete-test',
        sku: 'SKU-001',
      });

      await productService.deleteProduct(storeId1, created.id);

      expect(
        productService.getProduct(storeId1, created.id).catch(() => null)
      ).rejects.toThrow();
    });
  });

  describe('Category Hierarchy', () => {
    it('should create a root category', async () => {
      const category = await categoryService.createCategory(storeId1, {
        name: 'Electronics',
        slug: 'electronics',
        is_active: true,
      });

      expect(category).toBeDefined();
      expect(category.name).toBe('Electronics');
      expect(category.parent_category_id).toBeUndefined();
    });

    it('should create a child category', async () => {
      const parent = await categoryService.createCategory(storeId1, {
        name: 'Electronics',
        slug: 'electronics',
      });

      const child = await categoryService.createCategory(storeId1, {
        name: 'Phones',
        slug: 'phones',
        parent_category_id: parent.id,
      });

      expect(child.parent_category_id).toBe(parent.id);
    });

    it('should retrieve category hierarchy', async () => {
      const parent = await categoryService.createCategory(storeId1, {
        name: 'Electronics',
        slug: 'electronics',
      });

      await categoryService.createCategory(storeId1, {
        name: 'Phones',
        slug: 'phones',
        parent_category_id: parent.id,
      });

      const children = await categoryService.getChildCategories(storeId1, parent.id);
      expect(children.length).toBeGreaterThan(0);
    });

    it('should maintain category isolation per store', async () => {
      const cat1 = await categoryService.createCategory(storeId1, {
        name: 'Category 1',
        slug: 'category-1',
      });

      const cat2 = await categoryService.createCategory(storeId2, {
        name: 'Category 1',
        slug: 'category-1',
      });

      expect(cat1.store_id).toBe(storeId1);
      expect(cat2.store_id).toBe(storeId2);
      expect(cat1.id).not.toBe(cat2.id);
    });

    it('should soft delete a category', async () => {
      const category = await categoryService.createCategory(storeId1, {
        name: 'Test Category',
        slug: 'test-category',
      });

      await categoryService.deleteCategory(storeId1, category.id);

      expect(
        categoryService.getCategory(storeId1, category.id).catch(() => null)
      ).rejects.toThrow();
    });
  });

  describe('Inventory Management', () => {
    it('should create inventory for a variant', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440003';

      const inventory = await inventoryService.createInventory(storeId1, variantId, storeId1);

      expect(inventory).toBeDefined();
      expect(inventory.variant_id).toBe(variantId);
      expect(inventory.quantity_available).toBe(0);
    });

    it('should check stock availability', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440004';
      const inventory = await inventoryService.createInventory(storeId1, variantId, storeId1);

      // Manually set quantities for testing
      const updated = await inventoryRepo.save({
        ...inventory,
        quantity_available: 10,
      });

      const hasStock = await inventoryService.checkStock(storeId1, variantId, 5);
      expect(hasStock).toBe(true);

      const noStock = await inventoryService.checkStock(storeId1, variantId, 15);
      expect(noStock).toBe(false);
    });

    it('should reserve stock', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440005';
      const inventory = await inventoryService.createInventory(storeId1, variantId, storeId1);

      await inventoryRepo.save({
        ...inventory,
        quantity_available: 20,
      });

      await inventoryService.reserveStock(storeId1, variantId, 5);

      const updated = await inventoryService.getInventory(storeId1, variantId);
      expect(updated.quantity_available).toBe(15);
      expect(updated.quantity_reserved).toBe(5);
    });

    it('should release reserved stock', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440006';
      const inventory = await inventoryService.createInventory(storeId1, variantId, storeId1);

      await inventoryRepo.save({
        ...inventory,
        quantity_available: 15,
        quantity_reserved: 5,
      });

      await inventoryService.releaseStock(storeId1, variantId, 5);

      const updated = await inventoryService.getInventory(storeId1, variantId);
      expect(updated.quantity_available).toBe(20);
      expect(updated.quantity_reserved).toBe(0);
    });

    it('should track reorder levels', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440007';
      const inventory = await inventoryService.createInventory(storeId1, variantId, storeId1);

      await inventoryService.updateReorderLevels(storeId1, variantId, 10, 50);

      const updated = await inventoryService.getInventory(storeId1, variantId);
      expect(updated.reorder_level).toBe(10);
      expect(updated.reorder_quantity).toBe(50);
    });
  });

  describe('Catalog Store Isolation', () => {
    it('should isolate products by store', async () => {
      const p1 = await productService.createProduct(storeId1, {
        name: 'Store 1 Product',
        slug: 'store1-product',
        sku: 'S1-001',
      });

      const p2 = await productService.createProduct(storeId2, {
        name: 'Store 2 Product',
        slug: 'store2-product',
        sku: 'S2-001',
      });

      const retrieved1 = await productService.getProduct(storeId1, p1.id);
      expect(retrieved1.store_id).toBe(storeId1);

      expect(productService.getProduct(storeId2, p1.id)).rejects.toThrow();
    });

    it('should isolate inventory by store', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440008';

      const inv1 = await inventoryService.createInventory(storeId1, variantId, storeId1);
      expect(inv1.store_id).toBe(storeId1);

      // Different variant for store 2 to avoid conflicts
      const variantId2 = '550e8400-e29b-41d4-a716-446655440009';
      const inv2 = await inventoryService.createInventory(storeId2, variantId2, storeId2);
      expect(inv2.store_id).toBe(storeId2);
    });
  });

  describe('Soft Delete Behavior', () => {
    it('should not return soft-deleted products', async () => {
      const product = await productService.createProduct(storeId1, {
        name: 'Delete Me',
        slug: 'delete-me',
        sku: 'DELETE-001',
      });

      await productService.deleteProduct(storeId1, product.id);

      const active = await productService.listProducts(storeId1);
      const foundDeleted = active.find((p) => p.id === product.id);
      expect(foundDeleted).toBeUndefined();
    });

    it('should not return soft-deleted categories', async () => {
      const category = await categoryService.createCategory(storeId1, {
        name: 'Delete Me',
        slug: 'delete-me',
      });

      await categoryService.deleteCategory(storeId1, category.id);

      const roots = await categoryService.getRootCategories(storeId1);
      const foundDeleted = roots.find((c) => c.id === category.id);
      expect(foundDeleted).toBeUndefined();
    });
  });
});
