/**
 * Authorization Middleware
 * Role-based access control for payment operations
 *
 * Phase 9d: Security & Authorization
 */

import { Request, Response, NextFunction } from 'express';
// NOTE: this module previously imported a non-existent `{ logger }` binding.
// That was latent only because the middleware was never mounted; once wired in,
// every call would have thrown a TypeError on `logger.debug`.
import { logDebug, logWarn, logError } from '../logging/logger';
import { verifyToken } from '../auth/services/jwt.service';

/**
 * User context attached to request
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: 'customer' | 'admin' | 'support' | 'system';
  storeId: string;
  permissions: string[];
}

/**
 * Extend Express Request to include auth context
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Authorization Middleware
 * Verifies user identity and attaches auth context to request
 */
export function authorizationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract auth token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid Authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verifies the HS256 signature and builds AuthContext from signed claims only.
    const auth = parseAuthToken(token);

    if (!auth) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
      });
      return;
    }

    // Attach auth context to request
    req.auth = auth;

    logDebug('Authorization successful', {
      userId: auth.userId,
      role: auth.role,
      path: req.path,
    });

    next();
  } catch (error) {
    logError('Authorization error', error as Error, { path: req.path });

    res.status(500).json({
      success: false,
      error: 'Authorization processing failed',
    });
  }
}

/**
 * Require Specific Role
 * Middleware factory for role-based access control
 */
export function requireRole(...allowedRoles: AuthContext['role'][]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      logWarn('Unauthorized access attempt', {
        userId: req.auth.userId,
        role: req.auth.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: `This operation requires one of roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Require Specific Permission
 * Permission-level access control
 */
export function requirePermission(permission: string): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!req.auth.permissions.includes(permission)) {
      logWarn('Permission denied', {
        userId: req.auth.userId,
        permission,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: `Permission denied: ${permission}`,
      });
      return;
    }

    next();
  };
}

/**
 * Role precedence, most privileged first.
 * A token carrying several roles resolves to the most privileged recognised one.
 */
const ROLE_PRECEDENCE: readonly AuthContext['role'][] = ['system', 'admin', 'support', 'customer'];

/**
 * Resolve a single effective role from the token's signed `roles` claim.
 * Unrecognised role strings are ignored rather than trusted.
 */
function resolveRole(roles: readonly string[] | undefined): AuthContext['role'] | null {
  if (!Array.isArray(roles) || roles.length === 0) {
    return null;
  }
  return ROLE_PRECEDENCE.find((candidate) => roles.includes(candidate)) ?? null;
}

/**
 * Parse Auth Token — verified JWT only.
 *
 * SECURITY: This previously split a plaintext `user:email:role:store:perms`
 * string and trusted the caller-supplied role, which allowed anyone to assert
 * `admin` by crafting a header. It now verifies an HS256 signature via the
 * shared JWT service and derives authority solely from signed claims.
 *
 * Two invariants:
 *  - `role` comes from the signed `roles` claim, never from the request.
 *  - `permissions` are derived server-side from ROLE_PERMISSIONS. A token
 *    cannot widen its own permission set.
 */
function parseAuthToken(token: string): AuthContext | null {
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const role = resolveRole(payload.roles);
  if (!payload.userId || !payload.email || !role) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role,
    // Signed store binding. Absent => empty, so checkStoreOwnership fails
    // closed for non-admin callers rather than silently passing.
    storeId: typeof payload.storeId === 'string' ? payload.storeId : '',
    permissions: ROLE_PERMISSIONS[role] ?? [],
  };
}

/**
 * Role Permissions Mapping
 */
export const ROLE_PERMISSIONS: Record<AuthContext['role'], string[]> = {
  customer: [
    'payment.create',
    'payment.confirm',
    'refund.request',
    'payment.view-own',
  ],

  admin: [
    'payment.create',
    'payment.confirm',
    'payment.capture',
    'payment.view-all',
    'refund.request',
    'refund.approve',
    'refund.reject',
    'refund.view-all',
    'audit.view',
    // Orders (Phase 2)
    'orders.view',
    'orders.update',
    'orders.fulfill',
    'orders.cancel',
  ],

  support: [
    'payment.view-all',
    'refund.view-all',
    'refund.request',
    'audit.view',
    // Support reads the order queue to answer customer questions, but does not
    // move money or change fulfilment state. Least privilege: read only until
    // there is a demonstrated need.
    'orders.view',
  ],

  system: [
    'payment.create',
    'payment.confirm',
    'payment.capture',
    'payment.update-status',
    'refund.create',
    'refund.process',
    'refund.update-status',
    'audit.log',
    // Internal/batch processes operate across stores.
    'store.access-all',
  ],
};

/**
 * Permission that authorises operating across store boundaries.
 * Held by `system` only — not granted to `admin` by default.
 */
export const CROSS_STORE_PERMISSION = 'store.access-all';

/**
 * Check Store Ownership
 * Ensure a caller only reaches data for the store their token is bound to.
 *
 * SECURITY: this previously exempted `admin` outright, so any admin could read
 * any store by changing the :storeId path segment. Cross-store access is now an
 * explicit capability (CROSS_STORE_PERMISSION) rather than a property of being
 * an admin — least privilege, and it keeps the check meaningful once the
 * platform is multi-store.
 */
export function checkStoreOwnership(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  const requestStoreId = req.params.storeId;
  const mayCrossStores = req.auth.permissions.includes(CROSS_STORE_PERMISSION);

  if (!mayCrossStores && req.auth.storeId !== requestStoreId) {
    logWarn('Store access denied', {
      userId: req.auth.userId,
      role: req.auth.role,
      userStore: req.auth.storeId,
      requestedStore: requestStoreId,
    });

    res.status(403).json({
      success: false,
      error: 'You do not have access to this store',
    });
    return;
  }

  next();
}
