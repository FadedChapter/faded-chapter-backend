/**
 * Phase 6 — payment permission and exposure tests.
 *
 * Payments carry two kinds of sensitive data, and they need different
 * treatment:
 *
 *  - Instrument details. Only a masked last four and a brand ever exist at this
 *    layer; the gateway never returns a full number. The tests assert nothing
 *    resembling a full card number can appear.
 *
 *  - Gateway internals. `metadata` holds webhook identifiers and signatures and
 *    is untyped, so whatever the gateway adds next would ship automatically.
 *    `risk_reason` describes how fraud detection reasons. Neither is actionable
 *    for an operator; both are useful to an attacker.
 *
 * Approving a refund sends money, so the permission separation around it is
 * stricter than for a read.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import { toAdminPaymentDTO, toCustomerPaymentDTO } from '../../core/dto/payment.dto';
import { toAdminTransactionDTO } from '../../core/dto/transaction.dto';
import type { PaymentEntity } from '../../core/entities/index';
import type { PaymentTransactionRow } from '../../core/repositories/payment.repositories';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

const row = {
  id: 'pay_1',
  orderId: 'order_1',
  orderNumber: 'ORD-1018',
  customerName: 'Sana Iyer',
  amount: '9109',
  currency: 'INR',
  status: 'captured',
  paymentMethodType: 'card',
  lastFour: '4242',
  cardBrand: 'visa',
  errorCode: null,
  riskRating: 'medium',
  gatewayPaymentId: 'pay_ABC123',
  createdAt: new Date('2026-09-15'),
} as unknown as PaymentTransactionRow;

const entity = {
  id: 'pay_1',
  store_id: 'store_secret',
  customer_id: 'cust_1',
  order_id: 'order_1',
  razorpay_payment_id: 'pay_ABC123',
  razorpay_order_id: 'order_XYZ789',
  amount: 9109,
  currency: 'INR',
  status: 'captured',
  payment_method: 'razorpay',
  payment_method_type: 'card',
  last_four: '4242',
  card_brand: 'visa',
  error_code: null,
  error_message: null,
  risk_rating: 'medium',
  risk_reason: 'Unusual velocity from this device fingerprint',
  metadata: {
    webhook_id: 'wh_SECRET',
    gateway_signature: 'sig_SECRET',
    raw_card_number: '4242424242424242',
  },
  created_at: new Date('2026-09-15'),
  updated_at: new Date('2026-09-15'),
} as unknown as PaymentEntity;

describe('Phase 6 — refund permission separation', () => {
  it('lets support read transactions, so they can answer payment questions', () => {
    expect(ROLE_PERMISSIONS.support).toContain('payment.view-all');
    expect(ROLE_PERMISSIONS.support).toContain('refund.view-all');
  });

  it('withholds refund approval and rejection from support', () => {
    // Approving sends money back. That is not a support decision.
    expect(ROLE_PERMISSIONS.support).not.toContain('refund.approve');
    expect(ROLE_PERMISSIONS.support).not.toContain('refund.reject');
  });

  it('gives admin the refund decision permissions', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('refund.approve');
    expect(ROLE_PERMISSIONS.admin).toContain('refund.reject');
  });

  it('never lets a customer approve a refund or read all payments', () => {
    expect(ROLE_PERMISSIONS.customer).not.toContain('refund.approve');
    expect(ROLE_PERMISSIONS.customer).not.toContain('refund.reject');
    expect(ROLE_PERMISSIONS.customer).not.toContain('payment.view-all');
    // A customer may request a refund on their own order — that is the limit.
    expect(ROLE_PERMISSIONS.customer).toContain('refund.request');
  });
});

describe('Phase 6 — gateway internals never reach a client', () => {
  it('keeps the metadata blob out of the transaction row', () => {
    const dto = toAdminTransactionDTO(row);
    expect(dto).not.toHaveProperty('metadata');
    expect(Object.keys(dto)).not.toContain('riskReason');
  });

  it('keeps metadata and risk rationale out of the admin payment shape', () => {
    const dto = toAdminPaymentDTO(entity);
    const serialized = JSON.stringify(dto);

    expect(dto).not.toHaveProperty('metadata');
    expect(serialized).not.toContain('wh_SECRET');
    expect(serialized).not.toContain('sig_SECRET');
    expect(serialized).not.toContain('Unusual velocity');
  });

  it('keeps everything internal out of the customer payment shape', () => {
    const dto = toCustomerPaymentDTO(entity);
    const serialized = JSON.stringify(dto);

    for (const secret of [
      'wh_SECRET',
      'sig_SECRET',
      'store_secret',
      'Unusual velocity',
      'pay_ABC123',
      'order_XYZ789',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(dto).not.toHaveProperty('riskRating');
  });
});

describe('Phase 6 — instrument details are masked everywhere', () => {
  it('exposes only the last four and the brand', () => {
    const admin = toAdminPaymentDTO(entity);
    expect(admin.lastFour).toBe('4242');
    expect(admin.cardBrand).toBe('visa');
  });

  it('never emits anything card-number shaped, even when the entity carries one', () => {
    // The fixture hides a full PAN inside metadata. Because metadata is not
    // mapped, it cannot surface — this asserts the allowlist does the work,
    // not that the data happened to be clean.
    for (const dto of [
      toAdminPaymentDTO(entity),
      toCustomerPaymentDTO(entity),
      toAdminTransactionDTO(row),
    ]) {
      expect(JSON.stringify(dto)).not.toMatch(/\d{13,19}/);
      expect(JSON.stringify(dto)).not.toContain('4242424242424242');
    }
  });
});

describe('Phase 6 — transaction row mapping', () => {
  it('coerces the driver’s numeric strings', () => {
    expect(toAdminTransactionDTO(row).amount).toBe(9109);
  });

  it('tolerates a payment with no order rather than inventing one', () => {
    // Pre-checkout payments exist and have no order; the row must render.
    const orphan = toAdminTransactionDTO({
      ...row,
      orderId: null,
      orderNumber: null,
      customerName: null,
    } as unknown as PaymentTransactionRow);

    expect(orphan.orderId).toBeNull();
    expect(orphan.orderNumber).toBeNull();
    expect(orphan.amount).toBe(9109);
  });
});
