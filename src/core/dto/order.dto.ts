/**
 * Response DTOs — orders.
 *
 * Allowlists, for the same reason as payment.dto.ts: a column added to
 * OrderEntity later must not reach the API by default. The failure mode is a
 * missing field, not a leaked one.
 *
 * Two audiences:
 *   - toAdminOrder*   what an operator needs to work the order queue
 *   - toCustomerOrder what the shopper may see about their own order
 *
 * `metadata` and `notes` are withheld from customers in every shape: notes is
 * the internal operator field (the shopper's own message is customer_notes),
 * and metadata is an untyped bag.
 */

import type { OrderEntity, OrderLineEntity } from '../entities/index';

export interface AdminOrderLineDTO {
  id: string;
  sku: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  fulfillmentStatus: string;
}

/** Row shape for the order list — deliberately lean; the table shows no more. */
export interface AdminOrderSummaryDTO {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: number;
  itemCount: number;
  customerName: string | null;
  placedAt: Date;
}

export interface AdminOrderDetailDTO extends AdminOrderSummaryDTO {
  customerId: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  paymentMethod: string | null;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  /** Internal operator notes. Admin surfaces only. */
  notes: string | null;
  /** Message written by the shopper. */
  customerNotes: string | null;
  lines: AdminOrderLineDTO[];
  updatedAt: Date;
  cancelledAt: Date | null;
}

export interface CustomerOrderDTO {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: number;
  placedAt: Date;
  lines: Array<Pick<AdminOrderLineDTO, 'sku' | 'productName' | 'variantName' | 'quantity' | 'lineTotal'>>;
}

function num(value: unknown): number {
  // Postgres numeric arrives as a string through the driver.
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function addressName(address: unknown): string | null {
  if (address && typeof address === 'object' && 'name' in address) {
    const name = (address as { name?: unknown }).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

export function toAdminOrderLineDTO(line: OrderLineEntity): AdminOrderLineDTO {
  return {
    id: line.id,
    sku: line.sku,
    productName: line.product_name,
    variantName: line.variant_name ?? null,
    quantity: num(line.quantity),
    unitPrice: num(line.unit_price),
    lineTotal: num(line.line_total),
    fulfillmentStatus: line.fulfillment_status,
  };
}

/**
 * @param itemCount Total units on the order. Passed in because the list query
 *                  aggregates it separately rather than loading every line;
 *                  detail callers derive it from the loaded lines.
 */
export function toAdminOrderSummaryDTO(
  order: OrderEntity,
  itemCount?: number,
): AdminOrderSummaryDTO {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    total: num(order.total),
    itemCount: itemCount ?? order.lines?.reduce((sum, line) => sum + num(line.quantity), 0) ?? 0,
    customerName: addressName(order.shipping_address),
    placedAt: order.created_at,
  };
}

export function toAdminOrderDetailDTO(order: OrderEntity): AdminOrderDetailDTO {
  return {
    ...toAdminOrderSummaryDTO(order),
    customerId: order.customer_id,
    subtotal: num(order.subtotal),
    taxAmount: num(order.tax_amount),
    shippingAmount: num(order.shipping_amount),
    discountAmount: num(order.discount_amount),
    paymentMethod: order.payment_method ?? null,
    shippingAddress: (order.shipping_address ?? {}) as Record<string, unknown>,
    billingAddress: (order.billing_address ?? {}) as Record<string, unknown>,
    notes: order.notes ?? null,
    customerNotes: order.customer_notes ?? null,
    lines: (order.lines ?? []).map(toAdminOrderLineDTO),
    updatedAt: order.updated_at,
    cancelledAt: order.cancelled_at ?? null,
  };
}

export function toCustomerOrderDTO(order: OrderEntity): CustomerOrderDTO {
  return {
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    total: num(order.total),
    placedAt: order.created_at,
    lines: (order.lines ?? []).map((line) => ({
      sku: line.sku,
      productName: line.product_name,
      variantName: line.variant_name ?? null,
      quantity: num(line.quantity),
      lineTotal: num(line.line_total),
    })),
  };
}
