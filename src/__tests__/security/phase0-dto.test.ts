/**
 * Phase 0 — response DTO boundary tests.
 *
 * Asserts that internal fields cannot reach the API even when present on the
 * entity. These guard the "minimum necessary" data-access principle: if someone
 * later swaps a mapper back to returning the entity, these fail.
 */

import { describe, it, expect } from 'vitest';
import {
  toAdminPaymentDTO,
  toCustomerPaymentDTO,
} from '../../core/dto/payment.dto';
import type { PaymentEntity } from '../../core/entities/index';

/** A payment carrying every internal field we must not leak. */
const entity = {
  id: 'pay_1',
  store_id: 'store_secret',
  customer_id: 'cust_1',
  order_id: 'order_1',
  razorpay_payment_id: 'rzp_pay_internal',
  razorpay_order_id: 'rzp_order_internal',
  amount: 1000,
  currency: 'INR',
  status: 'captured',
  payment_method: 'razorpay',
  payment_method_type: 'card',
  last_four: '4242',
  card_brand: 'visa',
  error_code: 'E_NONE',
  error_message: 'none',
  risk_rating: 'low',
  risk_reason: 'internal scoring rationale — must never ship',
  metadata: {
    webhook_id: 'wh_secret',
    gateway_signature: 'sig_secret',
    internal_notes: 'do not expose',
  },
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
} as unknown as PaymentEntity;

describe('Phase 0 — admin payment DTO', () => {
  const dto = toAdminPaymentDTO(entity);

  it('never exposes the raw gateway metadata blob', () => {
    expect(dto).not.toHaveProperty('metadata');
    expect(JSON.stringify(dto)).not.toContain('wh_secret');
    expect(JSON.stringify(dto)).not.toContain('sig_secret');
  });

  it('never exposes internal risk rationale', () => {
    expect(dto).not.toHaveProperty('riskReason');
    expect(dto).not.toHaveProperty('risk_reason');
    expect(JSON.stringify(dto)).not.toContain('internal scoring rationale');
  });

  it('does not leak store_id', () => {
    expect(JSON.stringify(dto)).not.toContain('store_secret');
  });

  it('still provides the operational fields staff need', () => {
    expect(dto.status).toBe('captured');
    expect(dto.riskRating).toBe('low');
    expect(dto.lastFour).toBe('4242');
    expect(dto.gatewayPaymentId).toBe('rzp_pay_internal');
  });
});

describe('Phase 0 — customer payment DTO', () => {
  const dto = toCustomerPaymentDTO(entity);

  it('exposes no internal or gateway fields at all', () => {
    const serialized = JSON.stringify(dto);
    for (const secret of [
      'rzp_pay_internal',
      'rzp_order_internal',
      'wh_secret',
      'sig_secret',
      'store_secret',
      'internal scoring rationale',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('withholds risk signals and error internals from the shopper', () => {
    expect(dto).not.toHaveProperty('riskRating');
    expect(dto).not.toHaveProperty('errorCode');
    expect(dto).not.toHaveProperty('errorMessage');
    expect(dto).not.toHaveProperty('customerId');
  });

  it('exposes only masked instrument details', () => {
    expect(dto.lastFour).toBe('4242');
    expect(dto.cardBrand).toBe('visa');
    expect(JSON.stringify(dto)).not.toMatch(/\d{13,}/); // no full PAN-like number
  });

  it('is a strict subset of the admin view', () => {
    const adminKeys = new Set(Object.keys(toAdminPaymentDTO(entity)));
    for (const key of Object.keys(dto)) {
      expect(adminKeys.has(key)).toBe(true);
    }
  });
});
