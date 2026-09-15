/**
 * Response DTOs — payments and refunds.
 *
 * Phase 0: Data-access boundary.
 *
 * Controllers previously serialised TypeORM entities straight to the client,
 * which makes exposure the default: any column added later ships to the API
 * automatically, and `PaymentEntity.metadata` is an untyped
 * `Record<string, any>` holding raw gateway payloads and webhook identifiers.
 *
 * These mappers are ALLOWLISTS. A new entity column is invisible to the API
 * until someone deliberately adds it here — the failure mode is a missing
 * field, not a leaked one.
 *
 * Two audiences, two shapes:
 *   - toAdminPaymentDTO    operational detail staff need (risk, gateway refs)
 *   - toCustomerPaymentDTO only what the shopper's own receipt requires
 */

import type { PaymentEntity, RefundEntity } from '../entities/index';

export interface AdminPaymentDTO {
  id: string;
  orderId: string | null;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethodType: string | null;
  /** Last four digits only — never a full instrument number. */
  lastFour: string | null;
  cardBrand: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  riskRating: string | null;
  gatewayPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Deliberately omitted: `metadata` (raw gateway/webhook blob),
  // `risk_reason` (internal scoring rationale), `store_id`.
}

export interface CustomerPaymentDTO {
  id: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethodType: string | null;
  lastFour: string | null;
  cardBrand: string | null;
  createdAt: Date;
  // Deliberately omitted: everything internal — risk signals, gateway ids,
  // error internals, metadata, customer_id, store_id.
}

export interface AdminRefundDTO {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function nullable<T>(value: T | undefined | null): T | null {
  return value ?? null;
}

export function toAdminPaymentDTO(payment: PaymentEntity): AdminPaymentDTO {
  return {
    id: payment.id,
    orderId: nullable(payment.order_id),
    customerId: payment.customer_id,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    paymentMethodType: nullable(payment.payment_method_type),
    lastFour: nullable(payment.last_four),
    cardBrand: nullable(payment.card_brand),
    errorCode: nullable(payment.error_code),
    errorMessage: nullable(payment.error_message),
    riskRating: nullable(payment.risk_rating),
    gatewayPaymentId: nullable(payment.razorpay_payment_id),
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  };
}

export function toCustomerPaymentDTO(payment: PaymentEntity): CustomerPaymentDTO {
  return {
    id: payment.id,
    orderId: nullable(payment.order_id),
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    paymentMethodType: nullable(payment.payment_method_type),
    lastFour: nullable(payment.last_four),
    cardBrand: nullable(payment.card_brand),
    createdAt: payment.created_at,
  };
}

export function toAdminRefundDTO(refund: RefundEntity): AdminRefundDTO {
  return {
    id: refund.id,
    paymentId: (refund as unknown as { payment_id: string }).payment_id,
    amount: Number((refund as unknown as { amount: number }).amount),
    currency: (refund as unknown as { currency: string }).currency,
    status: (refund as unknown as { status: string }).status,
    reason: nullable((refund as unknown as { reason?: string }).reason),
    createdAt: (refund as unknown as { created_at: Date }).created_at,
    updatedAt: (refund as unknown as { updated_at: Date }).updated_at,
  };
}

export function toAdminPaymentDTOs(payments: PaymentEntity[]): AdminPaymentDTO[] {
  return payments.map(toAdminPaymentDTO);
}

export function toAdminRefundDTOs(refunds: RefundEntity[]): AdminRefundDTO[] {
  return refunds.map(toAdminRefundDTO);
}
