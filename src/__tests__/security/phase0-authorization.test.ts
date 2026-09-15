/**
 * Phase 0 security-boundary tests.
 *
 * These encode the Phase 0 verification gate. They are deliberately written
 * against the authorization primitives rather than a live HTTP server so they
 * run without a database and cannot pass for environmental reasons.
 *
 * Gate covered here:
 *   - no token                 -> 401
 *   - invalid/garbage token    -> 401
 *   - forged plaintext "admin" -> 401   (the pre-Phase-0 bypass)
 *   - customer JWT on admin    -> 403
 *   - admin JWT                -> allowed
 *   - admin without permission -> 403
 *   - cross-store access       -> 403
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { generateToken } from '../../core/auth/services/jwt.service';
import {
  authorizationMiddleware,
  requireRole,
  requirePermission,
  checkStoreOwnership,
  CROSS_STORE_PERMISSION,
} from '../../core/middleware/authorization.middleware';

const STORE_A = '550e8400-e29b-41d4-a716-446655440000';
const STORE_B = '660e8400-e29b-41d4-a716-446655440001';

beforeAll(() => {
  loadConfig();
  // authorizationMiddleware logs via the shared logger; server.ts initialises it
  // at startup, so the test harness must do the same.
  initializeLogger();
});

/** Minimal Express double that records status/body and next() calls. */
function harness(options: {
  authHeader?: string;
  params?: Record<string, string>;
  method?: string;
} = {}) {
  const req = {
    headers: options.authHeader ? { authorization: options.authHeader } : {},
    params: options.params ?? {},
    method: options.method ?? 'GET',
    path: '/stores/x/dashboard/metrics',
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as Response & { statusCode: number; body: unknown };

  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

function tokenFor(roles: string[], storeId = STORE_A): string {
  return generateToken({
    userId: 'user-test',
    email: 'test@faded.test',
    emailVerified: true,
    roles,
    storeId,
  });
}

/** Run authorizationMiddleware then the given guards, stopping at first rejection. */
function runChain(
  h: ReturnType<typeof harness>,
  guards: Array<(req: Request, res: Response, next: NextFunction) => void>,
) {
  const chain = [authorizationMiddleware, ...guards];
  for (const guard of chain) {
    let advanced = false;
    const next = (() => {
      advanced = true;
    }) as NextFunction;
    guard(h.req, h.res, next);
    if (!advanced) {
      return { allowed: false, status: h.res.statusCode };
    }
  }
  return { allowed: true, status: 200 };
}

describe('Phase 0 gate — authentication', () => {
  it('rejects a request with no Authorization header (401)', () => {
    const h = harness();
    const result = runChain(h, [requireRole('admin')]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });

  it('rejects a malformed token (401)', () => {
    const h = harness({ authHeader: 'Bearer not-a-jwt' });
    const result = runChain(h, [requireRole('admin')]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });

  it('rejects the legacy forged plaintext admin token (401)', () => {
    // This exact string granted full admin before Phase 0.
    const forged = `Bearer attacker:attacker@evil.com:admin:${STORE_A}:refund.approve,audit.view`;
    const h = harness({ authHeader: forged });
    const result = runChain(h, [requireRole('admin')]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret (401)', () => {
    // Structurally valid JWT, wrong signature.
    const wrong =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
      '.eyJ1c2VySWQiOiJ4Iiwicm9sZXMiOlsiYWRtaW4iXX0' +
      '.YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo';
    const h = harness({ authHeader: `Bearer ${wrong}` });
    const result = runChain(h, [requireRole('admin')]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe('Phase 0 gate — role authorization', () => {
  it('denies a valid customer JWT on an admin route (403)', () => {
    const h = harness({ authHeader: `Bearer ${tokenFor(['customer'])}` });
    const result = runChain(h, [requireRole('admin', 'support', 'system')]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it('allows a valid admin JWT on an admin route', () => {
    const h = harness({
      authHeader: `Bearer ${tokenFor(['admin'])}`,
      params: { storeId: STORE_A },
    });
    const result = runChain(h, [
      requireRole('admin', 'support', 'system'),
      checkStoreOwnership,
      requirePermission('payment.view-all'),
    ]);
    expect(result.allowed).toBe(true);
  });

  it('ignores unrecognised role strings rather than trusting them', () => {
    const h = harness({ authHeader: `Bearer ${tokenFor(['superuser', 'root'])}` });
    const result = runChain(h, [requireRole('admin')]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401); // no recognised role => not authenticated
  });
});

describe('Phase 0 gate — permission authorization', () => {
  it('denies an authorized admin lacking the required permission (403)', () => {
    const h = harness({
      authHeader: `Bearer ${tokenFor(['support'])}`,
      params: { storeId: STORE_A },
    });
    // support has audit.view but NOT refund.approve
    const result = runChain(h, [
      requireRole('admin', 'support', 'system'),
      requirePermission('refund.approve'),
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it('does not let a token widen its own permissions', () => {
    // Permissions are derived server-side from role, so a self-asserted
    // permission claim in the token must have no effect.
    const token = generateToken({
      userId: 'user-test',
      email: 'test@faded.test',
      emailVerified: true,
      roles: ['customer'],
      storeId: STORE_A,
      // @ts-expect-error deliberately injecting an unsanctioned claim
      permissions: ['refund.approve', 'audit.view'],
    });
    const h = harness({ authHeader: `Bearer ${token}`, params: { storeId: STORE_A } });
    const result = runChain(h, [requirePermission('refund.approve')]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });
});

describe('Phase 0 gate — store isolation', () => {
  it('denies an admin reaching a store their token is not bound to (403)', () => {
    const h = harness({
      authHeader: `Bearer ${tokenFor(['admin'], STORE_A)}`,
      params: { storeId: STORE_B },
    });
    const result = runChain(h, [requireRole('admin'), checkStoreOwnership]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it('denies a customer reaching another store (403)', () => {
    const h = harness({
      authHeader: `Bearer ${tokenFor(['customer'], STORE_A)}`,
      params: { storeId: STORE_B },
    });
    const result = runChain(h, [checkStoreOwnership]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it('allows cross-store access only with the explicit capability', () => {
    const h = harness({
      authHeader: `Bearer ${tokenFor(['system'], STORE_A)}`,
      params: { storeId: STORE_B },
    });
    const result = runChain(h, [checkStoreOwnership]);
    expect(result.allowed).toBe(true);
  });

  it('grants CROSS_STORE_PERMISSION to system but not to admin', async () => {
    const { ROLE_PERMISSIONS } = await import('../../core/middleware/authorization.middleware');
    expect(ROLE_PERMISSIONS.system).toContain(CROSS_STORE_PERMISSION);
    expect(ROLE_PERMISSIONS.admin).not.toContain(CROSS_STORE_PERMISSION);
    expect(ROLE_PERMISSIONS.customer).not.toContain(CROSS_STORE_PERMISSION);
  });
});
