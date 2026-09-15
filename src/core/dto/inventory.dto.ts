/**
 * Response DTOs — inventory.
 *
 * Allowlists, as elsewhere. The sensitivity here is different from payments or
 * margin: inventory numbers are competitively useful. Exact on-hand counts,
 * polled over time, disclose sales velocity; reorder levels and reorder
 * quantities disclose purchasing strategy. None of it belongs on a storefront,
 * which needs one bit: can this be bought right now.
 */

import type { InventoryEntity } from '../entities/index';
import type { InventoryStockRow } from '../repositories/catalog.repositories';

export interface AdminStockDTO {
  id: string;
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productName: string;
  productStatus: string;
  available: number;
  reserved: number;
  /** Sellable total an operator reasons about: on hand minus what is held. */
  onHand: number;
  reorderLevel: number;
  reorderQuantity: number;
  /** Derived server-side so the threshold has exactly one definition. */
  needsReorder: boolean;
  isOutOfStock: boolean;
  lastCountedAt: Date | null;
  updatedAt: Date;
}

/** Storefront shape: availability only, never a number. */
export interface CustomerStockDTO {
  sku: string;
  inStock: boolean;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function toAdminStockDTO(row: InventoryStockRow): AdminStockDTO {
  const available = num(row.available);
  const reserved = num(row.reserved);
  const reorderLevel = num(row.reorderLevel);

  return {
    id: row.id,
    variantId: row.variantId,
    sku: row.sku,
    variantName: row.variantName,
    productId: row.productId,
    productName: row.productName,
    productStatus: row.productStatus,
    available,
    reserved,
    onHand: available + reserved,
    reorderLevel,
    reorderQuantity: num(row.reorderQuantity),
    // Out-of-stock is past the point of reordering and is reported separately,
    // so the reorder flag stays a signal to act rather than a duplicate alarm.
    needsReorder: available > 0 && available <= reorderLevel,
    isOutOfStock: available <= 0,
    lastCountedAt: row.lastCountedAt ?? null,
    updatedAt: row.updatedAt,
  };
}

/** For the single-record view after a mutation, where an entity is to hand. */
export function toAdminStockFromEntity(
  inventory: InventoryEntity,
  identity: Pick<
    AdminStockDTO,
    'sku' | 'variantName' | 'productId' | 'productName' | 'productStatus'
  >,
): AdminStockDTO {
  const available = num(inventory.quantity_available);
  const reserved = num(inventory.quantity_reserved);
  const reorderLevel = num(inventory.reorder_level);

  return {
    id: inventory.id,
    variantId: inventory.variant_id,
    ...identity,
    available,
    reserved,
    onHand: available + reserved,
    reorderLevel,
    reorderQuantity: num(inventory.reorder_quantity),
    needsReorder: available > 0 && available <= reorderLevel,
    isOutOfStock: available <= 0,
    lastCountedAt: inventory.last_counted_at ?? null,
    updatedAt: inventory.updated_at,
  };
}

export function toCustomerStockDTO(
  sku: string,
  inventory: InventoryEntity | null,
): CustomerStockDTO {
  return {
    sku,
    // A boolean, deliberately. Exact counts polled over time disclose sales
    // velocity, and reorder policy discloses purchasing strategy.
    inStock: num(inventory?.quantity_available) > 0,
  };
}
