/**
 * Response DTOs — shipping.
 *
 * The public/admin split here is unusually consequential, because shipping
 * methods are one of the few things a storefront legitimately must list.
 *
 * A shopper choosing at checkout needs a name, a price and a delivery estimate.
 * They do not need `metadata`, which carries carrier codes and service codes —
 * the operational identifiers of who actually moves the parcel and on which
 * contract. Nor do they need the rate card behind the price: weight bands,
 * zone codes and per-unit rates together describe the cost structure of the
 * business, and a competitor can read margin out of them.
 */

import type { ShippingMethodEntity, ShippingRateEntity } from '../entities/index';

export interface AdminShippingMethodDTO {
  id: string;
  name: string;
  description: string | null;
  type: string;
  baseCost: number;
  estDaysMin: number;
  estDaysMax: number;
  active: boolean;
  /** Carrier/service identifiers. Admin only. */
  carrier: string | null;
  serviceCode: string | null;
  rateCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminShippingRateDTO {
  id: string;
  methodId: string;
  zoneCode: string;
  weightMin: number;
  weightMax: number;
  baseRate: number;
  ratePerUnit: number;
  active: boolean;
}

/**
 * Storefront shape: enough to choose a delivery option, nothing about how it
 * is priced or who carries it.
 */
export interface CustomerShippingMethodDTO {
  id: string;
  name: string;
  description: string | null;
  /** The price the shopper pays. Not the rate card that produced it. */
  cost: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function metaString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
}

export function toAdminShippingMethodDTO(
  method: ShippingMethodEntity,
  rateCount = 0,
): AdminShippingMethodDTO {
  return {
    id: method.id,
    name: method.name,
    description: method.description ?? null,
    type: method.type,
    baseCost: num(method.base_cost),
    estDaysMin: num(method.est_days_min),
    estDaysMax: num(method.est_days_max),
    active: Boolean(method.active),
    // Lifted out of metadata into named fields, so the untyped bag itself never
    // has to be serialised to expose the two values operators actually use.
    carrier: metaString(method.metadata, 'carrier'),
    serviceCode: metaString(method.metadata, 'serviceCode'),
    rateCount,
    createdAt: method.created_at,
    updatedAt: method.updated_at,
  };
}

export function toAdminShippingRateDTO(rate: ShippingRateEntity): AdminShippingRateDTO {
  return {
    id: rate.id,
    methodId: rate.method_id,
    zoneCode: rate.zone_code,
    weightMin: num(rate.weight_min),
    weightMax: num(rate.weight_max),
    baseRate: num(rate.base_rate),
    ratePerUnit: num(rate.rate_per_unit),
    active: Boolean(rate.active),
  };
}

export function toCustomerShippingMethodDTO(
  method: ShippingMethodEntity,
): CustomerShippingMethodDTO {
  return {
    id: method.id,
    name: method.name,
    description: method.description ?? null,
    cost: num(method.base_cost),
    estimatedDaysMin: num(method.est_days_min),
    estimatedDaysMax: num(method.est_days_max),
    // metadata, store_id, type and the rate table are deliberately absent.
  };
}
