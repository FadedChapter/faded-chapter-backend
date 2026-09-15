/**
 * Phase 3 — catalogue permission and data-exposure tests.
 *
 * Two concerns, both easy to erode silently:
 *
 *  1. Permission separation. Support can read the catalogue to confirm what a
 *     customer ordered, but must not be able to change pricing or availability.
 *
 *  2. Margin data. ProductVariantEntity.cost is unit cost. The admin console
 *     shows it (and derives margin from it) because operators need it; it must
 *     never appear in a storefront shape. This is the single most damaging
 *     field in the catalogue to leak.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import {
  toAdminVariantDTO,
  toCustomerVariantDTO,
} from '../../core/dto/product.dto';
import type { ProductVariantEntity, InventoryEntity } from '../../core/entities/index';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

/** A variant carrying every internal field the storefront must not receive. */
const variant = {
  id: 'var_1',
  product_id: 'prod_1',
  store_id: 'store_secret',
  sku: 'FC-HWC-BONE',
  name: 'Bone',
  price: 5900,
  cost: 2478,
  compare_at_price: 7200,
  attributes: { size: 'M', colour: 'Bone' },
  status: 'active',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
} as unknown as ProductVariantEntity;

/** Shaped as InventoryEntity, which is what the mappers actually read. */
const stock = {
  quantity_available: 42,
  quantity_reserved: 2,
  reorder_level: 10,
} as unknown as InventoryEntity;

describe('Phase 3 — catalogue permission separation', () => {
  it('grants support read access to the catalogue', () => {
    expect(ROLE_PERMISSIONS.support).toContain('products.view');
  });

  it('withholds catalogue mutation from support', () => {
    expect(ROLE_PERMISSIONS.support).not.toContain('products.update');
  });

  it('gives admin both read and mutate', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('products.view');
    expect(ROLE_PERMISSIONS.admin).toContain('products.update');
  });

  it('gives customers no catalogue permissions at all', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('products.')).toBe(false);
    }
  });
});

describe('Phase 3 — margin data must not reach the storefront', () => {
  it('exposes cost to admin, who needs it to judge margin', () => {
    const dto = toAdminVariantDTO(variant, stock);
    expect(dto.cost).toBe(2478);
  });

  it('never exposes cost in the customer shape', () => {
    const dto = toCustomerVariantDTO(variant, stock);
    expect(dto).not.toHaveProperty('cost');
    expect(JSON.stringify(dto)).not.toContain('2478');
  });

  it('does not leak store_id to the storefront', () => {
    const dto = toCustomerVariantDTO(variant, stock);
    expect(JSON.stringify(dto)).not.toContain('store_secret');
  });

  it('does not expose exact stock counts or reorder levels to the storefront', () => {
    const dto = toCustomerVariantDTO(variant, stock);
    // Reorder level is an internal purchasing signal; exact counts let a
    // competitor infer sales volume by polling.
    expect(dto).not.toHaveProperty('reorderLevel');
    expect(dto).not.toHaveProperty('stockReserved');
    expect(dto).not.toHaveProperty('needsReorder');
  });

  it('reports availability to the storefront as a boolean, never a count', () => {
    // Deliberately NOT a strict subset of the admin shape: admin gets
    // stockAvailable (a number), the storefront gets inStock (a boolean).
    // Asserting a subset here would force the exact count into the customer
    // response — the very thing this boundary exists to prevent.
    const dto = toCustomerVariantDTO(variant, stock);
    expect(dto.inStock).toBe(true);
    expect(dto).not.toHaveProperty('stockAvailable');

    const outOfStock = toCustomerVariantDTO(variant, {
      quantity_available: 0,
      quantity_reserved: 0,
      reorder_level: 10,
    } as unknown as InventoryEntity);
    expect(outOfStock.inStock).toBe(false);
  });
});
