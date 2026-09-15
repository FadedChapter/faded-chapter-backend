/**
 * Staff & roles — permission and lockout-guard tests.
 *
 * This module governs who can use every other module, so its failure modes are
 * different in kind from a data leak:
 *
 *  - An administrator removing their own access, or the organisation's last
 *    administrator, cannot be undone from inside the product. The recovery path
 *    is a database console.
 *  - `system` carries store.access-all. Granting it to a person through a UI
 *    would put a human outside the store scoping every other check relies on.
 *  - Read access alone discloses the roster and who holds administrator rights,
 *    which is a useful first step for anyone trying to escalate — so unlike
 *    every other module, support gets nothing here.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS, CROSS_STORE_PERMISSION } from '../../core/middleware/authorization.middleware';
import {
  ASSIGNABLE_ROLES,
  NON_ASSIGNABLE,
  MIN_PASSWORD_LENGTH,
} from '../../core/controllers/admin-staff.controller';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

describe('Staff — access is admin-only at every level', () => {
  it('gives admin both read and manage', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('staff.view');
    expect(ROLE_PERMISSIONS.admin).toContain('staff.manage');
  });

  it('gives support nothing, not even read', () => {
    // Deliberately stricter than every other module: the roster and who holds
    // admin rights is reconnaissance, not something support needs.
    expect(ROLE_PERMISSIONS.support).not.toContain('staff.view');
    expect(ROLE_PERMISSIONS.support).not.toContain('staff.manage');
  });

  it('gives customers nothing', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('staff.')).toBe(false);
    }
  });

  it('is the only module where support has no read access', () => {
    // Guards against someone "fixing the inconsistency" by adding staff.view
    // to support. Every other read is granted; this one is withheld on purpose.
    for (const readPermission of [
      'orders.view',
      'products.view',
      'inventory.view',
      'customers.view',
      'shipping.view',
      'discounts.view',
      'alerts.view',
    ]) {
      expect(ROLE_PERMISSIONS.support).toContain(readPermission);
    }
    expect(ROLE_PERMISSIONS.support).not.toContain('staff.view');
  });
});

describe('Staff — the system role is not assignable to a person', () => {
  it('excludes system from the assignable set', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('system' as never);
    expect(NON_ASSIGNABLE).toContain('system');
  });

  it('is the role that can cross store boundaries, which is why', () => {
    // If this ever stops being true the exclusion needs revisiting — but while
    // it holds, no human should hold it.
    expect(ROLE_PERMISSIONS.system).toContain(CROSS_STORE_PERMISSION);
    for (const role of ASSIGNABLE_ROLES) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(CROSS_STORE_PERMISSION);
    }
  });

  it('offers exactly the roles a person can hold', () => {
    expect([...ASSIGNABLE_ROLES].sort()).toEqual(['admin', 'customer', 'support']);
  });
});

describe('Staff — credential rules', () => {
  it('requires a longer password than a shopper account', () => {
    // Staff credentials unlock the entire console, including refunds and
    // pricing, so the bar is higher than for a storefront login.
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});

describe('Staff — role catalogue integrity', () => {
  it('gives admin strictly more permissions than support', () => {
    expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(ROLE_PERMISSIONS.support.length);
  });

  it('gives support strictly more than a customer', () => {
    expect(ROLE_PERMISSIONS.support.length).toBeGreaterThan(ROLE_PERMISSIONS.customer.length);
  });

  it('never grants a customer an admin-console permission', () => {
    const consolePrefixes = [
      'orders.',
      'products.',
      'inventory.',
      'customers.',
      'analytics.',
      'discounts.',
      'shipping.',
      'alerts.',
      'staff.',
      'audit.',
    ];
    for (const permission of ROLE_PERMISSIONS.customer) {
      for (const prefix of consolePrefixes) {
        expect(permission.startsWith(prefix)).toBe(false);
      }
    }
  });

  it('gives support no permission ending in a mutating verb', () => {
    // Support reads widely and changes nothing. Stated as a shape rule so a new
    // module cannot quietly hand support a write.
    const mutating = ['.update', '.manage', '.adjust', '.approve', '.reject', '.cancel', '.fulfill'];
    for (const permission of ROLE_PERMISSIONS.support) {
      for (const verb of mutating) {
        if (permission.endsWith(verb)) {
          // refund.request is a request, not an approval — it is the one
          // deliberate exception and does not end in a mutating verb above.
          expect(permission).toBe('__no_mutating_permission_expected__');
        }
      }
    }
  });
});
