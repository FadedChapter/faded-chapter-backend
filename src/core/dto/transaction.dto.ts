/**
 * Response DTO — transactions list row.
 *
 * Separate from payment.dto.ts because the list row spans payment and order,
 * whereas AdminPaymentDTO maps a PaymentEntity alone.
 *
 * Two fields are deliberately absent from every payment shape in this codebase
 * and are worth restating where a new mapper is written:
 *
 *   - `metadata` — the raw gateway blob. It carries webhook identifiers and
 *     gateway signatures, and it is untyped, so whatever the gateway adds next
 *     ships to the client automatically. Nothing renders it.
 *   - `risk_reason` — the internal scoring rationale. The rating is actionable
 *     for an operator; the reasoning behind it is not, and describes how fraud
 *     detection works.
 *
 * `lastFour` and `cardBrand` are the only instrument details present. There is
 * no path by which a full card number could reach this layer — the gateway
 * never returns one — and that is the intended state.
 */

import type { PaymentTransactionRow } from '../repositories/payment.repositories';

export interface AdminTransactionDTO {
  id: string;
  orderId: string | null;
  /** Null when a payment predates its order, or the order was hard-deleted. */
  orderNumber: string | null;
  customerName: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethodType: string | null;
  lastFour: string | null;
  cardBrand: string | null;
  errorCode: string | null;
  riskRating: string | null;
  gatewayPaymentId: string | null;
  createdAt: Date;
}

function num(value: unknown): number {
  // Postgres numeric arrives as a string through the driver.
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function toAdminTransactionDTO(row: PaymentTransactionRow): AdminTransactionDTO {
  return {
    id: row.id,
    orderId: row.orderId ?? null,
    orderNumber: row.orderNumber ?? null,
    customerName: row.customerName ?? null,
    amount: num(row.amount),
    currency: row.currency,
    status: row.status,
    paymentMethodType: row.paymentMethodType ?? null,
    lastFour: row.lastFour ?? null,
    cardBrand: row.cardBrand ?? null,
    errorCode: row.errorCode ?? null,
    riskRating: row.riskRating ?? null,
    gatewayPaymentId: row.gatewayPaymentId ?? null,
    createdAt: row.createdAt,
  };
}
