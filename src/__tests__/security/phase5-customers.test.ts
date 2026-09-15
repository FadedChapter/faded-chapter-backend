/**
 * Phase 5 — customer permission and PII tests.
 *
 * The subject here is a person, not a figure, so the tests are stricter than
 * elsewhere. Three properties are locked down:
 *
 *  1. Nothing authentication-related is ever serialisable from a customer
 *     response. Password hashes, tokens and session identifiers live in
 *     adjacent tables; no admin task needs them, and their presence in a
 *     payload is a credential-theft surface whether or not anything renders it.
 *
 *  2. The list carries strictly less than the record. Lists are browsed,
 *     exported and shoulder-surfed far more often than a record is opened, so
 *     contact details require the deliberate act of opening one.
 *
 *  3. Changing a customer's status is a decision about a person's access to the
 *     store, so it stays with admin rather than support.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import {
  toAdminCustomerSummaryDTO,
  toAdminCustomerDetailDTO,
} from '../../core/dto/customer.admin.dto';
import type { CustomerEntity } from '../../core/entities/index';
import type { CustomerListRow } from '../../core/repositories/customer.repository';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

/** A list row carrying internal plumbing alongside the real columns. */
const listRow = {
  id: 'cust_1',
  email: 'aria.mehta@example.com',
  firstName: 'Aria',
  lastName: 'Mehta',
  phone: '+91 98200 11234',
  status: 'active',
  emailVerified: true,
  createdAt: new Date('2026-01-01'),
  order_count: '3',
  lifetime_value: '60454',
  last_order_at: new Date('2026-09-01'),
} as unknown as CustomerListRow;

/** An entity deliberately polluted with fields that must never escape. */
const entity = {
  id: 'cust_1',
  store_id: 'store_secret',
  email: 'aria.mehta@example.com',
  email_normalized: 'aria.mehta@example.com',
  first_name: 'Aria',
  last_name: 'Mehta',
  phone: '+91 98200 11234',
  status: 'active',
  email_verified: true,
  email_verified_at: new Date('2026-01-02'),
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-02-01'),
  deleted_at: null,
  // Relation properties that exist on the entity type.
  credentials: { password_hash: '$2b$12$SUPERSECRETHASH' },
  sessions: [{ id: 'sess_1', token: 'session-token-secret' }],
} as unknown as CustomerEntity;

const summary = { orderCount: 3, lifetimeValue: 60454, lastOrderAt: new Date('2026-09-01') };

describe('Phase 5 — customer permission separation', () => {
  it('grants support read access to customers', () => {
    expect(ROLE_PERMISSIONS.support).toContain('customers.view');
  });

  it('withholds customer mutation from support', () => {
    expect(ROLE_PERMISSIONS.support).not.toContain('customers.update');
  });

  it('gives admin both read and mutate', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('customers.view');
    expect(ROLE_PERMISSIONS.admin).toContain('customers.update');
  });

  it('gives customers no admin customer permissions at all', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('customers.')).toBe(false);
    }
  });
});

describe('Phase 5 — credentials never reach an admin response', () => {
  it('omits password hashes and session tokens from the detail record', () => {
    const dto = toAdminCustomerDetailDTO(entity, summary, []);
    const serialized = JSON.stringify(dto);

    expect(serialized).not.toContain('SUPERSECRETHASH');
    expect(serialized).not.toContain('session-token-secret');
    expect(dto).not.toHaveProperty('credentials');
    expect(dto).not.toHaveProperty('sessions');
  });

  it('omits internal plumbing from the detail record', () => {
    const dto = toAdminCustomerDetailDTO(entity, summary, []);
    expect(JSON.stringify(dto)).not.toContain('store_secret');
    expect(dto).not.toHaveProperty('email_normalized');
    expect(dto).not.toHaveProperty('emailNormalized');
    expect(dto).not.toHaveProperty('deletedAt');
  });
});

describe('Phase 5 — the list carries less than the record', () => {
  it('does not put phone numbers in the list', () => {
    const row = toAdminCustomerSummaryDTO(listRow);
    expect(row).not.toHaveProperty('phone');
    expect(JSON.stringify(row)).not.toContain('98200');
  });

  it('exposes the phone number only on the record', () => {
    const dto = toAdminCustomerDetailDTO(entity, summary, []);
    expect(dto.phone).toBe('+91 98200 11234');
  });

  it('keeps every list field present on the record too', () => {
    // The record is a superset: an operator who opens a row never loses
    // information that the list had shown them.
    const detailKeys = new Set(Object.keys(toAdminCustomerDetailDTO(entity, summary, [])));
    for (const key of Object.keys(toAdminCustomerSummaryDTO(listRow))) {
      expect(detailKeys.has(key)).toBe(true);
    }
  });
});

describe('Phase 5 — purchase rollups', () => {
  it('coerces numeric strings from the driver', () => {
    // Postgres returns COUNT and SUM as strings; a string would break every
    // comparison and sort built on these figures.
    const row = toAdminCustomerSummaryDTO(listRow);
    expect(row.orderCount).toBe(3);
    expect(row.lifetimeValue).toBe(60454);
  });

  it('reports zero average order value for a customer with no orders', () => {
    // Not NaN: dividing by a zero order count would serialise to null and read
    // as "unknown" when the true answer is zero.
    const dto = toAdminCustomerDetailDTO(
      entity,
      { orderCount: 0, lifetimeValue: 0, lastOrderAt: null },
      [],
    );
    expect(dto.averageOrderValue).toBe(0);
    expect(Number.isNaN(dto.averageOrderValue)).toBe(false);
  });

  it('derives average order value from lifetime value and count', () => {
    const dto = toAdminCustomerDetailDTO(entity, summary, []);
    expect(dto.averageOrderValue).toBe(Math.round(60454 / 3));
  });

  it('renders a nameless customer as null rather than an empty string', () => {
    const anonymous = toAdminCustomerSummaryDTO({
      ...listRow,
      firstName: null,
      lastName: null,
    } as unknown as CustomerListRow);
    expect(anonymous.name).toBeNull();
  });
});
