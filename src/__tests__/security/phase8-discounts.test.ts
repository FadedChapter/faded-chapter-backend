/**
 * Phase 8 — discount permission, validation and exposure tests.
 *
 * A promo code is spendable value, which makes this module's failure modes
 * financial rather than informational:
 *
 *  - An unauthorised create is someone minting themselves free merchandise.
 *  - A percentage above 100 pays the customer to order.
 *  - A publicly listable code set defeats every targeted campaign, because a
 *    code's entire value is that not everyone has it.
 *
 * The redeemability rule is tested separately from status because the two
 * legitimately disagree, and conflating them is how an "active" code that the
 * checkout rejects becomes a support ticket nobody can explain.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import { toAdminPromoCodeDTO, computeRedeemable } from '../../core/dto/discount.dto';
import type { PromoCodeEntity } from '../../core/entities/index';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

const DAY = 86_400_000;

function promo(overrides: Partial<PromoCodeEntity> = {}): PromoCodeEntity {
  return {
    id: 'promo_1',
    store_id: 'store_secret',
    code: 'WELCOME10',
    discount_type: 'percentage',
    discount_value: 10,
    description: 'First order discount',
    status: 'active',
    usage_limit: 100,
    usage_count: 5,
    min_purchase: 2000,
    max_discount: 1500,
    stackable: false,
    start_date: new Date(Date.now() - DAY),
    end_date: new Date(Date.now() + DAY * 30),
    metadata: { campaign: 'welcome', internal_budget: 'SECRET-BUDGET-CODE' },
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as unknown as PromoCodeEntity;
}

describe('Phase 8 — issuing a code is an admin action', () => {
  it('lets support read codes, since they are asked why one was rejected', () => {
    expect(ROLE_PERMISSIONS.support).toContain('discounts.view');
  });

  it('does not let support issue or withdraw a code', () => {
    expect(ROLE_PERMISSIONS.support).not.toContain('discounts.manage');
  });

  it('gives admin both', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('discounts.view');
    expect(ROLE_PERMISSIONS.admin).toContain('discounts.manage');
  });

  it('gives customers no discount permissions at all', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('discounts.')).toBe(false);
    }
  });
});

describe('Phase 8 — redeemability is not the same as status', () => {
  it('honours an active code inside its window with uses left', () => {
    expect(computeRedeemable(promo())).toBe(true);
  });

  it('refuses a code that has not started yet', () => {
    // Scheduling a campaign ahead of time is normal; it must not be live early.
    expect(computeRedeemable(promo({ start_date: new Date(Date.now() + DAY) }))).toBe(false);
  });

  it('refuses a code past its end date even while marked active', () => {
    expect(computeRedeemable(promo({ end_date: new Date(Date.now() - DAY) }))).toBe(false);
  });

  it('refuses a code that has exhausted its usage limit', () => {
    expect(computeRedeemable(promo({ usage_limit: 100, usage_count: 100 }))).toBe(false);
    // And one that somehow overshot it.
    expect(computeRedeemable(promo({ usage_limit: 100, usage_count: 137 }))).toBe(false);
  });

  it('allows an unlimited code regardless of how often it has been used', () => {
    expect(
      computeRedeemable(promo({ usage_limit: null as never, usage_count: 50_000 })),
    ).toBe(true);
  });

  it('refuses inactive and expired codes outright', () => {
    expect(computeRedeemable(promo({ status: 'inactive' }))).toBe(false);
    expect(computeRedeemable(promo({ status: 'expired' }))).toBe(false);
  });

  it('treats a code with no end date as open-ended rather than expired', () => {
    expect(computeRedeemable(promo({ end_date: null as never }))).toBe(true);
  });
});

describe('Phase 8 — uses remaining distinguishes unlimited from exhausted', () => {
  it('reports null for an unlimited code, not zero', () => {
    // Zero would read as "exhausted" and stop an operator using a live code.
    const dto = toAdminPromoCodeDTO(promo({ usage_limit: null as never }));
    expect(dto.usesRemaining).toBeNull();
    expect(dto.usageLimit).toBeNull();
  });

  it('reports zero for an exhausted code', () => {
    const dto = toAdminPromoCodeDTO(promo({ usage_limit: 100, usage_count: 100 }));
    expect(dto.usesRemaining).toBe(0);
  });

  it('never reports a negative remaining count', () => {
    const dto = toAdminPromoCodeDTO(promo({ usage_limit: 100, usage_count: 137 }));
    expect(dto.usesRemaining).toBe(0);
  });
});

describe('Phase 8 — campaign internals stay out of responses', () => {
  it('does not expose the metadata bag', () => {
    const dto = toAdminPromoCodeDTO(promo());
    expect(dto).not.toHaveProperty('metadata');
    expect(JSON.stringify(dto)).not.toContain('SECRET-BUDGET-CODE');
  });

  it('does not leak store_id', () => {
    expect(JSON.stringify(toAdminPromoCodeDTO(promo()))).not.toContain('store_secret');
  });
});
