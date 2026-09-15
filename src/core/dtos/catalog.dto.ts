/**
 * Catalog DTOs
 * Data Transfer Objects for catalog domain
 *
 * Phase 4: Catalog Domain
 */

/**
 * Product DTOs
 */
export class CreateProductDto {
  name: string;
  slug: string;
  description?: string;
  sku: string;
  status?: 'active' | 'draft' | 'archived' | 'discontinued';
  is_featured?: boolean;
  display_order?: number;
  metadata?: Record<string, any>;
  created_by?: string;
}

export class UpdateProductDto {
  name?: string;
  slug?: string;
  description?: string;
  sku?: string;
  status?: 'active' | 'draft' | 'archived' | 'discontinued';
  is_featured?: boolean;
  display_order?: number;
  metadata?: Record<string, any>;
}

export class ProductResponseDto {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description?: string;
  sku: string;
  status: string;
  is_featured: boolean;
  display_order: number;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Category DTOs
 */
export class CreateCategoryDto {
  name: string;
  slug: string;
  description?: string;
  parent_category_id?: string;
  display_order?: number;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export class UpdateCategoryDto {
  name?: string;
  slug?: string;
  description?: string;
  parent_category_id?: string | null;
  display_order?: number;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export class CategoryResponseDto {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_category_id?: string;
  display_order: number;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Product Variant DTOs
 */
export class CreateVariantDto {
  sku: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  weight?: number;
  attributes?: Record<string, any>;
  status?: 'active' | 'draft' | 'inactive';
  display_order?: number;
}

export class UpdateVariantDto {
  sku?: string;
  name?: string;
  description?: string;
  price?: number;
  cost?: number;
  weight?: number;
  attributes?: Record<string, any>;
  status?: 'active' | 'draft' | 'inactive';
  display_order?: number;
}

export class VariantResponseDto {
  id: string;
  product_id: string;
  store_id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  weight?: number;
  attributes?: Record<string, any>;
  status: string;
  display_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Inventory DTOs
 */
export class CreateInventoryDto {
  quantity_available?: number;
  quantity_reserved?: number;
  reorder_level?: number;
  reorder_quantity?: number;
}

export class UpdateInventoryDto {
  quantity_available?: number;
  quantity_reserved?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  last_counted_at?: Date;
}

export class InventoryResponseDto {
  id: string;
  variant_id: string;
  store_id: string;
  quantity_available: number;
  quantity_reserved: number;
  reorder_level: number;
  reorder_quantity: number;
  last_counted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class ReserveStockDto {
  quantity: number;
}

export class ReleaseStockDto {
  quantity: number;
}

/**
 * Product Image DTOs
 */
export class CreateProductImageDto {
  url: string;
  alt_text?: string;
  display_order?: number;
  is_primary?: boolean;
}

export class UpdateProductImageDto {
  url?: string;
  alt_text?: string;
  display_order?: number;
  is_primary?: boolean;
}

export class ProductImageResponseDto {
  id: string;
  product_id: string;
  store_id: string;
  url: string;
  alt_text?: string;
  display_order: number;
  is_primary: boolean;
  created_at: Date;
  deleted_at?: Date;
}

export class ReorderImagesDto {
  images: Array<{ id: string; order: number }>;
}
