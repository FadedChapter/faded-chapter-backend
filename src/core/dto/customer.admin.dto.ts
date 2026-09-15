/**
 * Response DTOs — customers (admin console).
 *
 * This is the most sensitive allowlist in the codebase: the subject is a real
 * person, not a figure. Three rules shape it.
 *
 * 1. Nothing authentication-related ever appears. Password hashes, session
 *    identifiers, verification and reset tokens live in adjacent tables and are
 *    never joined into an admin response. A support agent has no task that
 *    requires them, and their presence in a response is a credential-theft
 *    surface whether or not anything renders them.
 *
 * 2. The list carries less than the detail. A list is browsed, exported and
 *    shoulder-surfed far more often than a record is opened, so it shows what
 *    is needed to find a person — name, email, status, value — and not their
 *    phone number. Contact details require opening the record, which is the
 *    point at which access is deliberate and audited.
 *
 * 3. `email_normalized` and `store_id` are internal plumbing and stay out.
 *
 * Named customer.admin.dto.ts because customer.dto.ts already exists and holds
 * the storefront's own account shapes; the two audiences must not be confused.
 */

import type { CustomerEntity } from '../entities/index';
import type { CustomerListRow } from '../repositories/customer.repository';

export interface AdminCustomerSummaryDTO {
  id: string;
  email: string;
  name: string | null;
  status: string;
  emailVerified: boolean;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: Date | null;
  createdAt: Date;
  // Deliberately absent: phone (detail only), email_normalized, store_id.
}

export interface AdminCustomerOrderDTO {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  placedAt: Date;
}

export interface AdminCustomerDetailDTO extends AdminCustomerSummaryDTO {
  firstName: string | null;
  lastName: string | null;
  /** Contact detail: available on the record, never in the list. */
  phone: string | null;
  emailVerifiedAt: Date | null;
  updatedAt: Date;
  /** Average order value, derived so the console and any segment agree. */
  averageOrderValue: number;
  orders: AdminCustomerOrderDTO[];
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function fullName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
}

export function toAdminCustomerSummaryDTO(row: CustomerListRow): AdminCustomerSummaryDTO {
  return {
    id: row.id,
    email: row.email,
    name: fullName(row.firstName, row.lastName),
    status: row.status,
    emailVerified: Boolean(row.emailVerified),
    orderCount: num(row.order_count),
    lifetimeValue: num(row.lifetime_value),
    lastOrderAt: row.last_order_at ?? null,
    createdAt: row.createdAt,
  };
}

export function toAdminCustomerDetailDTO(
  customer: CustomerEntity,
  summary: { orderCount: number; lifetimeValue: number; lastOrderAt: Date | null },
  orders: AdminCustomerOrderDTO[],
): AdminCustomerDetailDTO {
  const orderCount = num(summary.orderCount);
  const lifetimeValue = num(summary.lifetimeValue);

  return {
    id: customer.id,
    email: customer.email,
    name: fullName(customer.first_name, customer.last_name),
    firstName: customer.first_name ?? null,
    lastName: customer.last_name ?? null,
    phone: customer.phone ?? null,
    status: customer.status,
    emailVerified: Boolean(customer.email_verified),
    emailVerifiedAt: customer.email_verified_at ?? null,
    orderCount,
    lifetimeValue,
    // Guarded: a customer with no orders would otherwise divide by zero and
    // report NaN, which serialises to null and reads as "unknown" rather than
    // the true answer, which is zero.
    averageOrderValue: orderCount > 0 ? Math.round(lifetimeValue / orderCount) : 0,
    lastOrderAt: summary.lastOrderAt ?? null,
    orders,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}
