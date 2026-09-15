/**
 * Phase 9 — shipping permission and rate-card exposure tests.
 *
 * Shipping is the one domain where a storefront legitimately must list
 * something, which makes the public/admin split the whole exercise.
 *
 * A shopper needs a name, a price and a delivery estimate. They must not
 * receive the carrier and service codes — the operational identifiers of who
 * moves the parcel and on which contract — nor the rate card behind the price.
 * Weight bands, zone codes and per-unit rates together describe the cost
 * structure of the business, and margin is readable from them.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import {
  toAdminShippingMethodDTO,
  toCustomerShippingMethodDTO,
  toAdminShippingRateDTO,
} from '../../core/dto/shipping.dto';
import type { ShippingMethodEntity, ShippingRateEntity } from '../../core/entities/index';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

const method = {
  id: 'method_1',
  store_id: 'store_secret',
  name: 'Standard Delivery',
  description: '4-6 business days across India',
  type: 'ground',
  base_cost: 99,
  est_days_min: 4,
  est_days_max: 6,
  active: true,
  metadata: {
    carrier: 'delhivery',
    serviceCode: 'SURFACE',
    contract: 'NEGOTIATED-2026-Q3',
    accountNumber: 'ACCT-SECRET-99',
  },
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-02-01'),
} as unknown as ShippingMethodEntity;

const rate = {
  id: 'rate_1',
  store_id: 'store_secret',
  method_id: 'method_1',
  weight_min: 0.5,
  weight_max: 2,
  zone_code: 'IN-METRO',
  base_rate: 139,
  rate_per_unit: 20,
  active: true,
} as unknown as ShippingRateEntity;

describe('Phase 9 — shipping permission separation', () => {
  it('lets support read shipping, since they are asked when an order will arrive', () => {
    expect(ROLE_PERMISSIONS.support).toContain('shipping.view');
  });

  it('does not let support change what delivery costs', () => {
    expect(ROLE_PERMISSIONS.support).not.toContain('shipping.manage');
  });

  it('gives admin both', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('shipping.view');
    expect(ROLE_PERMISSIONS.admin).toContain('shipping.manage');
  });

  it('gives customers no shipping permissions at all', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('shipping.')).toBe(false);
    }
  });
});

describe('Phase 9 — the storefront gets a price, not a rate structure', () => {
  const customer = toCustomerShippingMethodDTO(method);

  it('returns exactly what is needed to choose a delivery option', () => {
    expect(Object.keys(customer).sort()).toEqual([
      'cost',
      'description',
      'estimatedDaysMax',
      'estimatedDaysMin',
      'id',
      'name',
    ]);
  });

  it('never reveals the carrier or service code', () => {
    const serialized = JSON.stringify(customer);
    expect(serialized).not.toContain('delhivery');
    expect(serialized).not.toContain('SURFACE');
    expect(customer).not.toHaveProperty('carrier');
    expect(customer).not.toHaveProperty('serviceCode');
  });

  it('never reveals contract or account identifiers', () => {
    const serialized = JSON.stringify(customer);
    expect(serialized).not.toContain('NEGOTIATED-2026-Q3');
    expect(serialized).not.toContain('ACCT-SECRET-99');
  });

  it('does not leak store_id or the raw metadata bag', () => {
    expect(JSON.stringify(customer)).not.toContain('store_secret');
    expect(customer).not.toHaveProperty('metadata');
  });

  it('withholds whether a method is active — that is an operator concern', () => {
    // The storefront only ever receives methods that are already available;
    // telling it about retired ones invites rendering an unbuyable option.
    expect(customer).not.toHaveProperty('active');
  });
});

describe('Phase 9 — admin gets the operational detail it needs', () => {
  const admin = toAdminShippingMethodDTO(method, 9);

  it('surfaces carrier and service code as named fields', () => {
    expect(admin.carrier).toBe('delhivery');
    expect(admin.serviceCode).toBe('SURFACE');
  });

  it('still does not serialise the whole metadata bag', () => {
    // Lifting two named values out is not the same as returning the bag: the
    // contract and account number sit alongside them and must not travel.
    expect(admin).not.toHaveProperty('metadata');
    expect(JSON.stringify(admin)).not.toContain('NEGOTIATED-2026-Q3');
    expect(JSON.stringify(admin)).not.toContain('ACCT-SECRET-99');
  });

  it('reports the rate count so an operator can see a method has no rates', () => {
    expect(admin.rateCount).toBe(9);
    expect(toAdminShippingMethodDTO(method, 0).rateCount).toBe(0);
  });

  it('maps a rate card row faithfully', () => {
    const dto = toAdminShippingRateDTO(rate);
    expect(dto.zoneCode).toBe('IN-METRO');
    expect(dto.weightMin).toBe(0.5);
    expect(dto.weightMax).toBe(2);
    expect(dto.baseRate).toBe(139);
    expect(dto.ratePerUnit).toBe(20);
  });

  it('coerces the driver’s numeric strings', () => {
    const stringy = toAdminShippingMethodDTO(
      { ...method, base_cost: '99.00', est_days_min: '4' } as unknown as ShippingMethodEntity,
      0,
    );
    expect(stringy.baseCost).toBe(99);
    expect(stringy.estDaysMin).toBe(4);
  });

  it('treats a method with no carrier metadata as null rather than throwing', () => {
    const bare = toAdminShippingMethodDTO(
      { ...method, metadata: {} } as unknown as ShippingMethodEntity,
      0,
    );
    expect(bare.carrier).toBeNull();
    expect(bare.serviceCode).toBeNull();
  });
});
