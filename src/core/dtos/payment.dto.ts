/**
 * Payment Domain DTOs
 * Data Transfer Objects for payment and refund management
 *
 * Phase 9: Payment Processing
 */

/**
 * Payment DTOs
 */
export class CreatePaymentIntentDto {
  order_id: string;
  customer_id: string;
  amount: number;
  currency?: string; // Default: INR
  metadata?: Record<string, any>;
}

export class ConfirmPaymentDto {
  payment_id: string;
  razorpay_payment_id: string; // From Razorpay checkout
  razorpay_order_id?: string; // Optional
  payment_method_type?: string; // card|netbanking|wallet|upi|emandate
}

export class CapturePaymentDto {
  payment_id: string;
  amount: number; // Amount to capture
}

export class PaymentResponseDto {
  id: string;
  store_id: string;
  order_id?: string;
  customer_id: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_method_type?: string;
  last_four?: string;
  card_brand?: string;
  error_code?: string;
  error_message?: string;
  risk_rating?: string;
  risk_reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export class PaymentListResponseDto {
  payments: PaymentResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Refund DTOs
 */
export class CreateRefundDto {
  payment_id: string;
  order_id: string;
  amount?: number; // Full refund if not specified
  reason: string; // requested_by_customer|fraudulent|duplicate|general|other
  notes?: string; // Admin notes on refund reason
}

export class ApproveRefundDto {
  refund_id: string;
  approved_by: string; // Admin user ID
  approval_notes?: string;
}

export class RejectRefundDto {
  refund_id: string;
  reason: string;
}

export class RefundResponseDto {
  id: string;
  store_id: string;
  payment_id: string;
  order_id: string;
  razorpay_refund_id?: string;
  amount: number;
  reason: string;
  status: string; // pending_approval|approved|rejected|succeeded|failed
  approved_by?: string;
  approval_date?: Date;
  approval_notes?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export class RefundListResponseDto {
  refunds: RefundResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Razorpay Webhook DTOs
 */
export class RazorpayWebhookDto {
  event: string; // payment.authorized|payment.failed|payment.captured|refund.created|refund.processed|dispute.created
  payload: {
    payment?: Record<string, any>;
    refund?: Record<string, any>;
    dispute?: Record<string, any>;
  };
  created_at: number; // Unix timestamp
}

export class RazorpayOrderDto {
  id!: string; // Razorpay Order ID
  amount!: number; // Amount in smallest currency unit (paise for INR)
  currency!: string;
  receipt?: string;
  status!: string; // created|attempted|paid|failed
  created_at!: number;
}

export class RazorpayPaymentDto {
  id!: string; // Razorpay Payment ID
  order_id!: string;
  amount!: number;
  currency!: string;
  status!: string; // authorized|captured|failed|refunded
  method!: string; // card|netbanking|wallet|upi|emandate
  card?: {
    id: string;
    entity: string;
    name?: string;
    last4: string;
    network: string;
    type: string;
    issuer?: string;
    international: boolean;
    emi: boolean;
    sub_type: string;
  };
  vpa?: string; // For UPI
  email!: string;
  contact!: string;
  description?: string;
  fee?: number;
  tax?: number;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_reason?: string;
  error_step?: string;
  error_field?: string;
  acquirer_data?: Record<string, any>;
  risk?: {
    signal: string; // high|medium|low|safe
    reason?: string;
  };
  created_at!: number;
}

export class RazorpayRefundDto {
  id!: string; // Razorpay Refund ID
  entity!: string;
  payment_id!: string;
  amount!: number;
  currency!: string;
  status!: string; // processed|failed|pending
  speed_processed?: string;
  speed_requested?: string;
  receipt?: string;
  reason?: string;
  notes?: Record<string, any>;
  created_at!: number;
}

/**
 * Payment Status Check DTOs
 */
export class CheckPaymentStatusDto {
  payment_id: string;
}

export class CheckPaymentStatusResponseDto {
  payment_id: string;
  status: string;
  razorpay_status?: string; // Status from Razorpay API
  last_check: Date;
  error?: string;
}

/**
 * Payment Analytics DTOs
 */
export class PaymentAnalyticsDto {
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: number;
  average_amount: number;
  refunded_amount: number;
  pending_refunds: number;
  date_range: {
    start: Date;
    end: Date;
  };
}
