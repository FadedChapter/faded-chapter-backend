/**
 * Catalog Controllers
 * HTTP request handlers for catalog domain
 *
 * Phase 4: Catalog Domain
 */

import { Request, Response } from 'express';
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
import {
  CreateProductDto,
  UpdateProductDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateVariantDto,
  UpdateVariantDto,
  CreateProductImageDto,
  ReorderImagesDto,
  ReserveStockDto,
  ReleaseStockDto,
} from '../dtos/catalog.dto';

/**
 * Product Controller
 */
export class ProductController {
  constructor(
    private productService: ProductService,
    private productRepo: ProductRepository,
    private variantRepo: VariantRepository,
    private imageRepo: ProductImageRepository
  ) {}

  async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const dto = req.body as CreateProductDto;

      const product = await this.productService.createProduct(storeId, dto);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const dto = req.body as UpdateProductDto;

      const product = await this.productService.updateProduct(storeId, productId, dto);
      res.status(200).json(product);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const product = await this.productService.getProduct(storeId, productId);
      res.status(200).json(product);
    } catch (error) {
      res.status(404).json({ error: 'Product not found' });
    }
  }

  async listProducts(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const products = await this.productService.listProducts(storeId, limit, offset);
      res.status(200).json(products);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!query) {
        res.status(400).json({ error: 'Search query required' });
        return;
      }

      const products = await this.productService.searchProducts(storeId, query, limit);
      res.status(200).json(products);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      await this.productService.deleteProduct(storeId, productId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async addVariant(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const dto = req.body as CreateVariantDto;

      // Ensure product exists
      await this.productService.getProduct(storeId, productId);

      // Check SKU uniqueness
      const skuExists = await this.variantRepo.skuExists(dto.sku, storeId);
      if (skuExists) {
        res.status(400).json({ error: `SKU "${dto.sku}" already exists` });
        return;
      }

      const variant = await this.variantRepo.create({
        product_id: productId,
        store_id: storeId,
        ...dto,
      } as any);

      res.status(201).json(variant);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async addImage(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const dto = req.body as CreateProductImageDto;

      // Ensure product exists
      await this.productService.getProduct(storeId, productId);

      const image = await this.imageRepo.create({
        product_id: productId,
        store_id: storeId,
        ...dto,
      } as any);

      res.status(201).json(image);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getImages(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const images = await this.imageRepo.findByProductId(productId, storeId);
      res.status(200).json(images);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async reorderImages(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, productId } = req.params;
      const { images } = req.body as ReorderImagesDto;

      await this.imageRepo.reorderImages(productId, storeId, images);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}

/**
 * Category Controller
 */
export class CategoryController {
  constructor(private categoryService: CategoryService, private categoryRepo: CategoryRepository) {}

  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const dto = req.body as CreateCategoryDto;

      const category = await this.categoryService.createCategory(storeId, dto);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, categoryId } = req.params;
      const dto = req.body as UpdateCategoryDto;

      const category = await this.categoryService.updateCategory(storeId, categoryId, dto);
      res.status(200).json(category);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getCategory(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, categoryId } = req.params;
      const category = await this.categoryService.getCategory(storeId, categoryId);
      res.status(200).json(category);
    } catch (error) {
      res.status(404).json({ error: 'Category not found' });
    }
  }

  async listRootCategories(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const categories = await this.categoryService.getRootCategories(storeId);
      res.status(200).json(categories);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getChildCategories(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, categoryId } = req.params;
      const categories = await this.categoryService.getChildCategories(storeId, categoryId);
      res.status(200).json(categories);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, categoryId } = req.params;
      await this.categoryService.deleteCategory(storeId, categoryId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}

/**
 * Inventory Controller
 */
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  /**
   * GET /inventory/:variantId — public storefront availability.
   *
   * SECURITY: this previously serialised the InventoryEntity directly, so an
   * anonymous caller received exact available and reserved counts plus the
   * reorder level and reorder quantity. Polled over time those counts disclose
   * sales velocity, and the reorder policy discloses purchasing strategy.
   *
   * The storefront needs one bit — can this be bought — so that is all it gets.
   * Operators read the real figures through /api/admin/.../inventory.
   */
  async getInventory(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, variantId } = req.params;
      const inventory = await this.inventoryService.getInventory(storeId, variantId);
      res.status(200).json({
        variantId,
        inStock: Number(inventory?.quantity_available ?? 0) > 0,
      });
    } catch (error) {
      res.status(404).json({ error: 'Inventory not found' });
    }
  }

  async checkStock(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, variantId } = req.params;
      const quantity = parseInt(req.query.quantity as string);

      if (!quantity || quantity <= 0) {
        res.status(400).json({ error: 'Invalid quantity' });
        return;
      }

      const available = await this.inventoryService.checkStock(storeId, variantId, quantity);
      res.status(200).json({ available, quantity });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async reserveStock(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, variantId } = req.params;
      const { quantity } = req.body as ReserveStockDto;

      await this.inventoryService.reserveStock(storeId, variantId, quantity);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async releaseStock(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, variantId } = req.params;
      const { quantity } = req.body as ReleaseStockDto;

      await this.inventoryService.releaseStock(storeId, variantId, quantity);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getLowStockItems(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const items = await this.inventoryService.getLowStockItems(storeId);
      res.status(200).json(items);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
