/**
 * Promotions & Discounts DTOs
 * Data Transfer Objects for promotions domain
 *
 * Phase 7: Promotions & Discounts Domain
 */

/**
 * Promo Code DTOs
 */
export class CreatePromoCodeDto {
  code: string;
  discount_type: 'percentage' | 'fixed' | 'free_shipping' | 'bogo' | 'tiered';
  discount_value: number;
  description?: string;
  usage_limit?: number;
  min_purchase?: number;
  max_discount?: number;
  applicable_products?: string[];
  applicable_categories?: string[];
  metadata?: Record<string, any>;
  start_date: Date;
  end_date?: Date;
  stackable?: boolean;
}

export class UpdatePromoCodeDto {
  code?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'expired';
  usage_limit?: number;
  min_purchase?: number;
  max_discount?: number;
  applicable_products?: string[];
  applicable_categories?: string[];
  metadata?: Record<string, any>;
  end_date?: Date;
  stackable?: boolean;
}

export class PromoCodeResponseDto {
  id: string;
  store_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  description?: string;
  status: string;
  usage_limit?: number;
  usage_count: number;
  min_purchase: number;
  max_discount?: number;
  applicable_products?: string[];
  applicable_categories?: string[];
  metadata?: Record<string, any>;
  start_date: Date;
  end_date?: Date;
  stackable: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Discount Application DTOs
 */
export class ApplyDiscountDto {
  coupon_code: string;
  cart_id?: string;
  order_id?: string;
}

export class RemoveDiscountDto {
  discount_id: string;
}

export class DiscountApplicationResponseDto {
  id: string;
  store_id: string;
  promo_code_id: string;
  cart_id?: string;
  order_id?: string;
  discount_amount: number;
  discount_percentage?: number;
  discount_type: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

/**
 * Discount Validation DTOs
 */
export class ValidatePromoCodeDto {
  code: string;
  cart_subtotal?: number;
}

export class PromoValidationResponseDto {
  valid: boolean;
  error?: string;
  promo_code?: PromoCodeResponseDto;
  estimated_discount?: number;
}

/**
 * Bulk Promotion DTOs
 */
export class BulkCreatePromoCodesDto {
  codes: string[];
  discount_type: 'percentage' | 'fixed' | 'free_shipping' | 'bogo' | 'tiered';
  discount_value: number;
  description?: string;
  usage_limit_per_code?: number;
  min_purchase?: number;
  start_date: Date;
  end_date?: Date;
  metadata?: Record<string, any>;
}

/**
 * Discount Analytics DTOs
 */
export class DiscountAnalyticsDto {
  promo_code_id: string;
  code: string;
  total_discount_amount: number;
  times_applied: number;
  times_used: number;
  average_discount: number;
  total_value_given: number;
}

export class PromoAnalyticsDto {
  total_active_promos: number;
  total_discounts_given: number;
  average_discount_value: number;
  most_used_promo: string;
  least_used_promo: string;
  expiring_soon_count: number;
}
