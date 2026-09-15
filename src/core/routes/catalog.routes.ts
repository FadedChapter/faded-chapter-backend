/**
 * Catalog Routes
 * API endpoints for product, category, and inventory management
 *
 * Phase 4: Catalog Domain
 */

import { Router } from 'express';
// Phase 0: administrative catalog operations were unauthenticated.
import { requireStaff } from '../middleware/require-staff.middleware';
import { ProductController } from '../controllers/catalog.controller';
import { CategoryController } from '../controllers/catalog.controller';
import { InventoryController } from '../controllers/catalog.controller';
import { ProductService } from '../services/catalog.service';
import { CategoryService } from '../services/catalog.service';
import { InventoryService } from '../services/catalog.service';
import { ProductRepository } from '../repositories/product.repository';
import {
  CategoryRepository,
  VariantRepository,
  InventoryRepository,
  ProductImageRepository,
} from '../repositories/catalog.repositories';

/**
 * Create catalog routes
 * Called from core routes registry
 */
export function createCatalogRoutes(): Router {
  const router = Router({ mergeParams: true });

  // Initialize repositories and services
  const productRepo = new ProductRepository();
  const categoryRepo = new CategoryRepository();
  const variantRepo = new VariantRepository();
  const inventoryRepo = new InventoryRepository();
  const imageRepo = new ProductImageRepository();

  const productService = new ProductService(productRepo, variantRepo, imageRepo);
  const categoryService = new CategoryService(categoryRepo);
  const inventoryService = new InventoryService(inventoryRepo);

  const productController = new ProductController(productService, productRepo, variantRepo, imageRepo);
  const categoryController = new CategoryController(categoryService, categoryRepo);
  const inventoryController = new InventoryController(inventoryService);

  /**
   * Product Routes
   * Base: /stores/:storeId/products
   */

  // List all products
  router.get('/products', (req, res) => productController.listProducts(req, res));

  // Search products
  router.get('/products/search', (req, res) => productController.searchProducts(req, res));

  // Create new product
  router.post('/products', requireStaff, (req, res) => productController.createProduct(req, res));

  // Get single product
  router.get('/products/:productId', (req, res) => productController.getProduct(req, res));

  // Update product
  router.put('/products/:productId', requireStaff, (req, res) => productController.updateProduct(req, res));

  // Delete product
  router.delete('/products/:productId', requireStaff, (req, res) => productController.deleteProduct(req, res));

  /**
   * Product Variant Routes
   * Base: /stores/:storeId/products/:productId/variants
   */

  // Add variant to product
  router.post('/products/:productId/variants', requireStaff, (req, res) => productController.addVariant(req, res));

  /**
   * Product Image Routes
   * Base: /stores/:storeId/products/:productId/images
   */

  // Add image to product
  router.post('/products/:productId/images', requireStaff, (req, res) => productController.addImage(req, res));

  // Get all images for product
  router.get('/products/:productId/images', (req, res) => productController.getImages(req, res));

  // Reorder images
  router.put('/products/:productId/images/reorder', requireStaff, (req, res) => productController.reorderImages(req, res));

  /**
   * Category Routes
   * Base: /stores/:storeId/categories
   */

  // List root categories
  router.get('/categories', (req, res) => categoryController.listRootCategories(req, res));

  // Create new category
  router.post('/categories', requireStaff, (req, res) => categoryController.createCategory(req, res));

  // Get single category
  router.get('/categories/:categoryId', (req, res) => categoryController.getCategory(req, res));

  // Update category
  router.put('/categories/:categoryId', requireStaff, (req, res) => categoryController.updateCategory(req, res));

  // Delete category
  router.delete('/categories/:categoryId', requireStaff, (req, res) => categoryController.deleteCategory(req, res));

  // Get child categories
  router.get('/categories/:categoryId/children', (req, res) =>
    categoryController.getChildCategories(req, res)
  );

  /**
   * Inventory Routes
   * Base: /stores/:storeId/inventory
   */

  // Static segment MUST be declared before '/inventory/:variantId', otherwise
  // Express matches 'low-stock' as a variantId and the staff guard below is
  // never reached (the route silently 404s instead of being protected).
  router.get('/inventory/low-stock', requireStaff, (req, res) => inventoryController.getLowStockItems(req, res));

  // Get inventory for variant
  router.get('/inventory/:variantId', (req, res) => inventoryController.getInventory(req, res));

  // Check stock availability
  router.get('/inventory/:variantId/check', (req, res) => inventoryController.checkStock(req, res));

  // Reserve stock
  router.post('/inventory/:variantId/reserve', (req, res) => inventoryController.reserveStock(req, res));

  // Release reserved stock
  router.post('/inventory/:variantId/release', (req, res) => inventoryController.releaseStock(req, res));

  // Get low stock items

  return router;
}
