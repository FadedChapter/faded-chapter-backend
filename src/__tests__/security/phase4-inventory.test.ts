/**
 * Phase 4 — inventory permission and data-exposure tests.
 *
 * Inventory has a different sensitivity profile from payments or margin. The
 * numbers are not secret in themselves, but they are competitively useful:
 * exact on-hand counts polled over time disclose sales velocity, and reorder
 * policy discloses purchasing strategy. The storefront needs one bit — can this
 * be bought — and that is all it should be able to learn.
 *
 * Adjusting stock is an accounting action: it changes what can be sold and what
 * the books say is owned. It stays with admin.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import { toAdminStockDTO, toCustomerStockDTO } from '../../core/dto/inventory.dto';
import type { InventoryEntity } from '../../core/entities/index';
import type { InventoryStockRow } from '../../core/repositories/catalog.repositories';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

const row = {
  id: 'inv_1',
  variantId: 'var_1',
  sku: 'FC-HWC-BONE',
  variantName: 'Bone',
  productId: 'prod_1',
  productName: 'The Heavyweight Crewneck',
  productStatus: 'active',
  available: 42,
  reserved: 2,
  reorderLevel: 10,
  reorderQuantity: 25,
  lastCountedAt: null,
  updatedAt: new Date('2026-01-02'),
} as InventoryStockRow;

describe('Phase 4 — inventory permission separation', () => {
  it('grants support read access to stock levels', () => {
    expect(ROLE_PERMISSIONS.support).toContain('inventory.view');
  });

  it('withholds stock adjustment from support', () => {
    expect(ROLE_PERMISSIONS.support).not.toContain('inventory.adjust');
  });

  it('gives admin both read and adjust', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('inventory.view');
    expect(ROLE_PERMISSIONS.admin).toContain('inventory.adjust');
  });

  it('gives customers no inventory permissions at all', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('inventory.')).toBe(false);
    }
  });
});

describe('Phase 4 — stock figures must not reach the storefront', () => {
  it('gives the storefront availability as a boolean and nothing else', () => {
    const dto = toCustomerStockDTO('FC-HWC-BONE', {
      quantity_available: 42,
      quantity_reserved: 2,
      reorder_level: 10,
      reorder_quantity: 25,
    } as unknown as InventoryEntity);

    expect(dto.inStock).toBe(true);
    expect(Object.keys(dto).sort()).toEqual(['inStock', 'sku']);

    // No count, reserved figure or reorder policy may appear anywhere in it.
    const serialized = JSON.stringify(dto);
    for (const leak of ['42', '25', 'reorder', 'reserved', 'available']) {
      expect(serialized.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it('reports out of stock without revealing that it is exactly zero', () => {
    const dto = toCustomerStockDTO('FC-HWC-OLIVE', {
      quantity_available: 0,
    } as unknown as InventoryEntity);
    expect(dto.inStock).toBe(false);
    expect(Object.keys(dto).sort()).toEqual(['inStock', 'sku']);
  });

  it('treats a missing inventory record as out of stock rather than throwing', () => {
    expect(toCustomerStockDTO('FC-NEW', null).inStock).toBe(false);
  });
});

describe('Phase 4 — admin stock rollups', () => {
  it('reports onHand as available plus reserved', () => {
    const dto = toAdminStockDTO(row);
    expect(dto.available).toBe(42);
    expect(dto.reserved).toBe(2);
    expect(dto.onHand).toBe(44);
  });

  it('flags reorder at or below the threshold', () => {
    expect(toAdminStockDTO({ ...row, available: 11 }).needsReorder).toBe(false);
    // Boundary: at the threshold is already worth acting on.
    expect(toAdminStockDTO({ ...row, available: 10 }).needsReorder).toBe(true);
    expect(toAdminStockDTO({ ...row, available: 1 }).needsReorder).toBe(true);
  });

  it('separates out-of-stock from needs-reorder so they do not double-report', () => {
    const empty = toAdminStockDTO({ ...row, available: 0 });
    expect(empty.isOutOfStock).toBe(true);
    // Past the point of a reorder warning — it has its own, louder state.
    expect(empty.needsReorder).toBe(false);
  });

  it('never reports negative stock as merely low', () => {
    const negative = toAdminStockDTO({ ...row, available: -5 });
    expect(negative.isOutOfStock).toBe(true);
    expect(negative.needsReorder).toBe(false);
  });
});
