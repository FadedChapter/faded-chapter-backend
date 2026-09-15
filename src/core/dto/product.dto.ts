/**
 * Response DTOs — catalogue.
 *
 * Allowlists, consistent with order.dto.ts and payment.dto.ts.
 *
 * One field matters more than the rest here: ProductVariantEntity.cost is the
 * unit cost price. It is margin data and must never reach a storefront
 * response — toCustomerVariantDTO omits it, and the admin shape includes it
 * only because pricing decisions need it.
 */

import type {
  ProductEntity,
  ProductVariantEntity,
  CategoryEntity,
  InventoryEntity,
} from '../entities/index';

export interface AdminProductSummaryDTO {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: string;
  isFeatured: boolean;
  categoryId: string | null;
  variantCount: number;
  /** Total units available across all variants. */
  stock: number;
  /** Lowest variant price, for "from ₹x" display. Null when no variants. */
  priceFrom: number | null;
  updatedAt: Date;
}

export interface AdminVariantDTO {
  id: string;
  sku: string;
  name: string;
  price: number;
  /** Unit cost — margin data. Admin surfaces only. */
  cost: number | null;
  attributes: Record<string, string>;
  status: string;
  stockAvailable: number;
  stockReserved: number;
  reorderLevel: number;
  /** True when available stock has fallen to or below the reorder level. */
  needsReorder: boolean;
}

export interface AdminProductDetailDTO extends AdminProductSummaryDTO {
  description: string | null;
  createdAt: Date;
  variants: AdminVariantDTO[];
  imageUrl: string | null;
}

export interface AdminCategoryDTO {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
  isActive: boolean;
  displayOrder: number;
}

/** Storefront shape. Deliberately carries no cost, status or stock internals. */
export interface CustomerVariantDTO {
  sku: string;
  name: string;
  price: number;
  attributes: Record<string, string>;
  /** Availability as a boolean — exact stock levels are competitive data. */
  inStock: boolean;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toAdminProductSummaryDTO(
  product: ProductEntity,
  rollup?: { variantCount: number; stock: number; priceFrom: number | null },
): AdminProductSummaryDTO {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku ?? null,
    status: product.status,
    isFeatured: Boolean(product.is_featured),
    categoryId: product.category_id ?? null,
    variantCount: rollup?.variantCount ?? 0,
    stock: rollup?.stock ?? 0,
    priceFrom: rollup?.priceFrom ?? null,
    updatedAt: product.updated_at,
  };
}

export function toAdminVariantDTO(
  variant: ProductVariantEntity,
  inventory?: InventoryEntity | null,
): AdminVariantDTO {
  const available = num(inventory?.quantity_available);
  const reorderLevel = num(inventory?.reorder_level);
  return {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    price: num(variant.price),
    cost: nullableNum(variant.cost),
    attributes: (variant.attributes ?? {}) as Record<string, string>,
    status: variant.status,
    stockAvailable: available,
    stockReserved: num(inventory?.quantity_reserved),
    reorderLevel,
    // Surfaced as a flag rather than left to each client to recompute, so the
    // reorder threshold has one definition.
    needsReorder: Boolean(inventory) && available <= reorderLevel,
  };
}

export function toAdminProductDetailDTO(
  product: ProductEntity,
  variants: AdminVariantDTO[],
  imageUrl: string | null,
): AdminProductDetailDTO {
  const stock = variants.reduce((sum, v) => sum + v.stockAvailable, 0);
  const prices = variants.map((v) => v.price).filter((p) => Number.isFinite(p));

  return {
    ...toAdminProductSummaryDTO(product, {
      variantCount: variants.length,
      stock,
      priceFrom: prices.length ? Math.min(...prices) : null,
    }),
    description: product.description ?? null,
    createdAt: product.created_at,
    variants,
    imageUrl,
  };
}

export function toAdminCategoryDTO(category: CategoryEntity): AdminCategoryDTO {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentCategoryId: category.parent_category_id ?? null,
    isActive: Boolean(category.is_active),
    displayOrder: num(category.display_order),
  };
}

export function toCustomerVariantDTO(
  variant: ProductVariantEntity,
  inventory?: InventoryEntity | null,
): CustomerVariantDTO {
  return {
    sku: variant.sku,
    name: variant.name,
    price: num(variant.price),
    attributes: (variant.attributes ?? {}) as Record<string, string>,
    inStock: num(inventory?.quantity_available) > 0,
    // cost, reorder levels and exact stock counts are deliberately absent.
  };
}
