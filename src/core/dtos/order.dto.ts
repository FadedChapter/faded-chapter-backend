/**
 * Order Management DTOs
 * Data Transfer Objects for order domain
 *
 * Phase 5: Order Management Domain
 */

/**
 * Order Line DTOs
 */
export class CreateOrderLineDto {
  product_variant_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  sku: string;
  product_name: string;
  variant_name?: string;
  metadata?: Record<string, any>;
}

export class UpdateOrderLineDto {
  quantity?: number;
  fulfillment_status?: 'unfulfilled' | 'fulfilled' | 'cancelled';
  metadata?: Record<string, any>;
}

export class OrderLineResponseDto {
  id: string;
  order_id: string;
  store_id: string;
  product_variant_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sku: string;
  product_name: string;
  variant_name?: string;
  fulfillment_status: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Order DTOs
 */
export class CreateOrderDto {
  customer_id: string;
  lines: CreateOrderLineDto[];
  subtotal: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  notes?: string;
  customer_notes?: string;
  payment_method?: string;
  shipping_address: Record<string, any>;
  billing_address?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class UpdateOrderDto {
  status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status?: 'unpaid' | 'paid' | 'refunded' | 'partially_refunded';
  fulfillment_status?: 'unfulfilled' | 'partially_fulfilled' | 'fulfilled';
  notes?: string;
  customer_notes?: string;
  payment_method?: string;
  metadata?: Record<string, any>;
}

export class OrderResponseDto {
  id: string;
  store_id: string;
  customer_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total: number;
  notes?: string;
  customer_notes?: string;
  payment_method?: string;
  shipping_address: Record<string, any>;
  billing_address: Record<string, any>;
  metadata?: Record<string, any>;
  lines?: OrderLineResponseDto[];
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
}

/**
 * Order Management DTOs
 */
export class MarkAsPaidDto {
  payment_method?: string;
}

export class MarkAsShippedDto {
  tracking_number?: string;
  carrier?: string;
}

export class FulfillLineDto {
  quantity?: number;
}

export class CancelOrderDto {
  reason?: string;
  refund_amount?: number;
}

export class OrderStatisticsDto {
  total_orders: number;
  pending_orders: number;
  paid_orders: number;
  unfulfilled_orders: number;
  total_revenue: number;
  average_order_value: number;
}

export class OrderSearchDto {
  customer_id?: string;
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  date_from?: Date;
  date_to?: Date;
  min_total?: number;
  max_total?: number;
  limit?: number;
  offset?: number;
}
