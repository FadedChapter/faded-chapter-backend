/**
 * Phase 2 — order module authorization and workflow tests.
 *
 * Two things worth locking down:
 *
 *  1. Permission separation. Support can read the order queue but must not
 *     mutate it. That distinction is the whole point of having permissions
 *     rather than a single "is staff" flag, and it is easy to erode by adding a
 *     permission to the wrong role.
 *
 *  2. The status transition table. Order status drives fulfilment and finance;
 *     a delivered order returning to pending, or a cancelled order shipping,
 *     produces states downstream flows cannot reconcile.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

/** Mirrors the table in admin-order.controller.ts. */
const ALLOWED_TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
} as const;

type Status = keyof typeof ALLOWED_TRANSITIONS;
const ALL: Status[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function canTransition(from: Status, to: Status): boolean {
  return (ALLOWED_TRANSITIONS[from] as readonly string[]).includes(to);
}

describe('Phase 2 — order permission separation', () => {
  it('grants support read access to orders', () => {
    expect(ROLE_PERMISSIONS.support).toContain('orders.view');
  });

  it('withholds every order mutation from support', () => {
    for (const permission of ['orders.update', 'orders.fulfill', 'orders.cancel']) {
      expect(ROLE_PERMISSIONS.support).not.toContain(permission);
    }
  });

  it('gives admin both read and mutate', () => {
    for (const permission of ['orders.view', 'orders.update', 'orders.fulfill', 'orders.cancel']) {
      expect(ROLE_PERMISSIONS.admin).toContain(permission);
    }
  });

  it('gives customers no order permissions at all', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('orders.')).toBe(false);
    }
  });
});

describe('Phase 2 — order status transitions', () => {
  it('treats delivered and cancelled as terminal', () => {
    expect(ALLOWED_TRANSITIONS.delivered).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it('never allows a terminal order to move anywhere', () => {
    for (const terminal of ['delivered', 'cancelled'] as Status[]) {
      for (const target of ALL) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('does not allow skipping fulfilment steps', () => {
    // pending -> delivered would mark an order delivered that was never shipped
    expect(canTransition('pending', 'delivered')).toBe(false);
    expect(canTransition('pending', 'shipped')).toBe(false);
    expect(canTransition('processing', 'delivered')).toBe(false);
  });

  it('does not allow moving backwards', () => {
    expect(canTransition('processing', 'pending')).toBe(false);
    expect(canTransition('shipped', 'processing')).toBe(false);
    expect(canTransition('delivered', 'shipped')).toBe(false);
  });

  it('allows cancellation only before dispatch', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('processing', 'cancelled')).toBe(true);
    // Once shipped, cancellation is a returns problem, not a status flip.
    expect(canTransition('shipped', 'cancelled')).toBe(false);
  });

  it('permits the full happy path', () => {
    expect(canTransition('pending', 'processing')).toBe(true);
    expect(canTransition('processing', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
  });

  it('never lists a status as a transition to itself', () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});
