/**
 * Cart & Checkout DTOs
 * Data Transfer Objects for cart domain
 *
 * Phase 6: Cart & Checkout Domain
 */

/**
 * Cart Line DTOs
 */
export class AddToCartDto {
  product_variant_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  sku: string;
  product_name: string;
  variant_name?: string;
  metadata?: Record<string, any>;
}

export class UpdateCartLineDto {
  quantity: number;
  metadata?: Record<string, any>;
}

export class CartLineResponseDto {
  id: string;
  cart_id: string;
  store_id: string;
  product_variant_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sku: string;
  product_name: string;
  variant_name?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Cart DTOs
 */
export class CartResponseDto {
  id: string;
  store_id: string;
  customer_id: string;
  status: string;
  subtotal: number;
  tax_estimate: number;
  shipping_estimate: number;
  discount_amount: number;
  total_estimate: number;
  coupon_codes: string[];
  metadata?: Record<string, any>;
  lines?: CartLineResponseDto[];
  item_count?: number;
  created_at: Date;
  updated_at: Date;
  converted_at?: Date;
}

/**
 * Cart Operations DTOs
 */
export class ApplyCouponDto {
  coupon_code: string;
}

export class RemoveCouponDto {
  coupon_code: string;
}

export class EstimateShippingDto {
  zip_code: string;
  country?: string;
  state?: string;
  city?: string;
}

export class ShippingEstimateDto {
  method: string;
  cost: number;
  estimated_days: number;
  carrier?: string;
}

export class CartTotalsDto {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

export class CalculateTotalsDto {
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  coupon_codes?: string[];
}

/**
 * Checkout DTOs
 */
export class CheckoutDto {
  shipping_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  billing_address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  shipping_method?: string;
  payment_method?: string;
  coupon_codes?: string[];
  notes?: string;
  metadata?: Record<string, any>;
}

export class ConvertToOrderDto {
  shipping_address: Record<string, any>;
  billing_address?: Record<string, any>;
  shipping_method?: string;
  payment_method?: string;
  notes?: string;
}

/**
 * Cart Analytics DTOs
 */
export class CartAnalyticsDto {
  total_active_carts: number;
  total_cart_value: number;
  average_cart_value: number;
  abandoned_carts: number;
  conversion_rate: number;
}

export class AbandonedCartsDto {
  cart_id: string;
  customer_id: string;
  cart_value: number;
  items_count: number;
  abandoned_since: Date;
}

/**
 * Cart Summary (lightweight response)
 */
export class CartSummaryDto {
  id: string;
  item_count: number;
  subtotal: number;
  total_estimate: number;
  coupon_codes: string[];
}
