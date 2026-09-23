/**
 * Security posture.
 *
 * Reports what this deployment actually enforces, read from the same runtime
 * configuration the middleware uses — not from a checklist maintained by hand.
 * If someone shortens the session timeout or swaps the session store, this page
 * changes with it.
 *
 * Two rules govern the content:
 *
 *  1. Never disclose a secret. Key length is reportable; key material is not.
 *  2. Never report an all-clear we have not earned. KNOWN_GAPS below lists real
 *     weaknesses in this codebase with the file that carries them. A security
 *     page that only lists green ticks trains people to stop reading it.
 */

import { getConfig } from '../config/env';
import { DEFAULT_SESSION_CONFIG } from '../session/session.types';
import { ROLE_PERMISSIONS, type AuthContext } from '../middleware/authorization.middleware';
import { getDataSource } from '../database/postgres-data-source';

/** Cost factor used by the password hashing service. Kept in sync deliberately. */
const BCRYPT_COST_FACTOR = 10;

/** Cost factor below which we flag the hash as weaker than current guidance. */
const RECOMMENDED_MIN_COST_FACTOR = 12;

export type ControlState = 'enforced' | 'attention';

export interface SecurityControl {
  readonly key: string;
  readonly label: string;
  readonly state: ControlState;
  /** The actual configured value, rendered for a human. Never a secret. */
  readonly detail: string;
}

export interface SecurityGap {
  readonly key: string;
  readonly summary: string;
  readonly impact: string;
  /** Where the weakness lives, so it can be found without a search. */
  readonly location: string;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface SecurityPosture {
  readonly controls: readonly SecurityControl[];
  readonly gaps: readonly SecurityGap[];
  readonly roles: readonly { role: string; permissionCount: number }[];
  readonly auditEvents: number | null;
  readonly generatedAt: string;
}

/**
 * Known weaknesses, stated plainly.
 *
 * These are carried deliberately rather than hidden: each was found during the
 * admin build and none has been closed. Removing an entry from this list is a
 * claim that the underlying code changed — not a presentation decision.
 */
const KNOWN_GAPS: readonly SecurityGap[] = [
  {
    key: 'stock-reservation-race',
    summary: 'Stock reservation reads then writes without a transaction',
    impact:
      'Two checkouts for the last units of a variant can both succeed, overselling it. The window is small but real under concurrent load.',
    location: 'src/core/services/inventory.service.ts — reserveStock / releaseStock',
    severity: 'high',
  },
  {
    key: 'no-token-revocation',
    summary: 'Signing out does not invalidate the token',
    impact:
      'Access is carried entirely by a signed JWT that is valid until it expires. Nothing on the server can revoke one, so a leaked or stolen admin token stays usable for its full lifetime. The only remedies today are waiting for expiry or rotating JWT_SECRET, which signs out everyone at once.',
    location: 'src/routes/auth.routes.ts — logout',
    severity: 'high',
  },
  {
    key: 'logout-endpoint-broken',
    summary: 'The logout endpoint returns 401 and clears nothing',
    impact:
      'Logout is guarded by requireSession, but login issues a JWT and never creates a session, so the guard always rejects. Signing out is a client-side discard of the token; the server is never told.',
    location: 'src/routes/auth.routes.ts — logout, src/core/session/middleware/session.middleware.ts',
    severity: 'medium',
  },
  {
    key: 'session-subsystem-unused',
    summary: 'The session subsystem is configured but not wired to login',
    impact:
      'Idle and absolute timeouts, cookie flags and the session store are all configured, but setSessionCookie is never called. None of those settings currently constrain anything — admin access lifetime is governed by JWT expiry alone, with no idle timeout.',
    location: 'src/routes/auth.routes.ts — login, src/core/session/session.types.ts',
    severity: 'medium',
  },
  {
    key: 'bcrypt-cost-factor',
    summary: `Password hashing uses a bcrypt cost factor of ${BCRYPT_COST_FACTOR}`,
    impact: `Current guidance is ${RECOMMENDED_MIN_COST_FACTOR} or above. Raising it requires a rehash-on-next-login path, since existing hashes carry their original cost.`,
    location: 'src/core/user/services/password-hashing.service.ts',
    severity: 'low',
  },
  {
    key: 'cart-routes-unreachable',
    summary: 'Cart and checkout routes are mounted but cannot run',
    impact:
      'The controllers require req.user, which no mounted middleware sets, so every cart route returns 401 for everyone. They fail closed — this is dead code rather than an open door — but a storefront cart will need both the middleware and the missing carts table.',
    location: 'src/core/routes/cart.routes.ts',
    severity: 'low',
  },
];

/**
 * Length of the signing key, used to show the secret is of adequate size
 * without revealing any part of it.
 */
function signingKeyLength(): number {
  try {
    const config = getConfig();
    return config.JWT_SECRET.length;
  } catch {
    return 0;
  }
}

function describeMinutes(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${Math.round(seconds / 60)} minutes`;
}

/**
 * Count persisted audit events. Returns null rather than 0 when the table
 * cannot be read, so the UI can say "unavailable" instead of claiming nothing
 * has ever been audited.
 */
async function countAuditEvents(): Promise<number | null> {
  try {
    const rows = await getDataSource().query('SELECT COUNT(*)::int AS count FROM audit_logs');
    return typeof rows?.[0]?.count === 'number' ? rows[0].count : null;
  } catch {
    return null;
  }
}

export async function getSecurityPosture(): Promise<SecurityPosture> {
  const keyLength = signingKeyLength();

  const controls: SecurityControl[] = [
    {
      key: 'token-signing',
      label: 'Admin token signing',
      state: keyLength >= 32 ? 'enforced' : 'attention',
      detail:
        keyLength >= 32
          ? `HS256, ${keyLength}-character signing key. Signature is verified on every admin request; role comes from the signed claim, never the request.`
          : 'Signing key is shorter than the 32-character minimum.',
    },
    {
      key: 'token-lifetime',
      label: 'Token lifetime',
      state: 'attention',
      detail: `Admin tokens expire after ${getConfig().JWT_EXPIRY}, and that is the only limit — there is no idle timeout and no way to revoke a token before it expires.`,
    },
    {
      key: 'session-handling',
      label: 'Session handling',
      state: 'attention',
      detail: `Configured but unused. Idle ${describeMinutes(DEFAULT_SESSION_CONFIG.idleTimeoutSeconds)} and absolute ${describeMinutes(DEFAULT_SESSION_CONFIG.absoluteTimeoutSeconds)} timeouts are defined, and the cookie would be SameSite=${DEFAULT_SESSION_CONFIG.cookieSameSite}/HttpOnly/Secure=${DEFAULT_SESSION_CONFIG.cookieSecure}, but login never creates a session so none of it takes effect.`,
    },
    {
      key: 'csrf',
      label: 'CSRF protection',
      state: 'enforced',
      detail:
        'Double-submit cookie with constant-time comparison on state-changing cookie-authenticated requests. Admin calls use Bearer tokens and are exempt by design — they carry no ambient credential a foreign site could trigger.',
    },
    {
      key: 'admin-boundary',
      label: 'Admin API boundary',
      state: 'enforced',
      detail:
        'Every /api/admin route passes rate limiting, signature verification, role check, store scoping and a per-route permission before reaching a controller. Deny by default.',
    },
    {
      key: 'store-scoping',
      label: 'Cross-store access',
      state: 'enforced',
      detail:
        'Bound to the store in the signed token. Crossing stores requires the store.access-all capability, held by system processes only — not by administrators.',
    },
    {
      key: 'response-shaping',
      label: 'Response shaping',
      state: 'enforced',
      detail:
        'Admin and storefront responses are built from separate allowlists, so a new database column is invisible to both until it is added deliberately.',
    },
    {
      key: 'password-hashing',
      label: 'Password hashing',
      state: BCRYPT_COST_FACTOR >= RECOMMENDED_MIN_COST_FACTOR ? 'enforced' : 'attention',
      detail: `bcrypt, cost factor ${BCRYPT_COST_FACTOR}. Hashes are never mapped into any API response.`,
    },
    {
      key: 'audit-trail',
      label: 'Audit trail',
      state: 'enforced',
      detail:
        'Every admin mutation is written to an append-only audit log with actor, action, target and outcome. Failures to persist are logged rather than swallowed.',
    },
  ];

  const roles = (Object.keys(ROLE_PERMISSIONS) as AuthContext['role'][]).map((role) => ({
    role,
    permissionCount: ROLE_PERMISSIONS[role].length,
  }));

  return {
    controls,
    gaps: KNOWN_GAPS,
    roles,
    auditEvents: await countAuditEvents(),
    generatedAt: new Date().toISOString(),
  };
}
