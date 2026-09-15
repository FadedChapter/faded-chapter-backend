/**
 * Response DTOs — discounts.
 *
 * A promo code's value is that not everyone has it, so `code` itself is the
 * sensitive field here. It appears in admin shapes and never in a storefront
 * one: a customer validating a code already knows the code they typed, and
 * telling them anything more lets them enumerate the rest.
 *
 * `metadata` is withheld for the same reason as elsewhere — it is an untyped
 * bag carrying campaign attribution, and whatever marketing puts in it next
 * would ship automatically.
 */

import type { PromoCodeEntity } from '../entities/index';

export interface AdminPromoCodeDTO {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  status: string;
  /** Derived, because "active" in the column can still be out of date range. */
  isRedeemable: boolean;
  usageCount: number;
  usageLimit: number | null;
  /** null when unlimited — distinct from 0, which would mean exhausted. */
  usesRemaining: number | null;
  minPurchase: number;
  maxDiscount: number | null;
  stackable: boolean;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
}

export interface PromoRedemptionDTO {
  promoCodeId: string;
  code: string;
  redemptions: number;
  discountGiven: number;
}

/**
 * Storefront answer to "is this code any good".
 * Carries no code list, no usage figures and no campaign data.
 */
export interface CustomerPromoResultDTO {
  valid: boolean;
  discountType: string | null;
  discountAmount: number | null;
  message: string;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Whether a code would actually be honoured right now.
 *
 * Status alone is not enough: a code can be marked active while sitting outside
 * its date range or having exhausted its usage limit. An operator looking at a
 * list needs the effective answer, not the stored flag, or they will wonder why
 * an "active" code is being rejected at checkout.
 */
function computeRedeemable(promo: PromoCodeEntity, now = new Date()): boolean {
  if (promo.status !== 'active') return false;
  if (promo.start_date && new Date(promo.start_date) > now) return false;
  if (promo.end_date && new Date(promo.end_date) < now) return false;
  const limit = nullableNum(promo.usage_limit);
  if (limit !== null && num(promo.usage_count) >= limit) return false;
  return true;
}

export function toAdminPromoCodeDTO(promo: PromoCodeEntity): AdminPromoCodeDTO {
  const limit = nullableNum(promo.usage_limit);
  const used = num(promo.usage_count);

  return {
    id: promo.id,
    code: promo.code,
    description: promo.description ?? null,
    discountType: promo.discount_type,
    discountValue: num(promo.discount_value),
    status: promo.status,
    isRedeemable: computeRedeemable(promo),
    usageCount: used,
    usageLimit: limit,
    usesRemaining: limit === null ? null : Math.max(limit - used, 0),
    minPurchase: num(promo.min_purchase),
    maxDiscount: nullableNum(promo.max_discount),
    stackable: Boolean(promo.stackable),
    startDate: promo.start_date,
    endDate: promo.end_date ?? null,
    createdAt: promo.created_at,
  };
}

export { computeRedeemable };
