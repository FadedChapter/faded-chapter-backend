/**
 * Session Domain Model
 *
 * Defines the session layer that bridges authenticated customer identity
 * with server-side authorization.
 *
 * Session is server-authoritative:
 * - Created on server after credential verification
 * - Stored server-side (database or adapter implementation)
 * - Identified to browser via opaque session token in HttpOnly cookie
 * - Expired/revoked on server (browser cannot extend or forge)
 */

/**
 * Opaque session identifier issued to browser.
 * Browser returns this in cookie on every request.
 * Server uses it to look up the actual session record.
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Customer ID from server authentication layer.
 * Authoritative identity tied to Shopify customer and orders.
 */
export type CustomerId = string & { readonly __brand: 'CustomerId' };

/**
 * Server-side session record (never exposed to browser).
 * Contains all authorization context needed to authorize requests.
 */
export interface SessionRecord {
  /** Unique session token (lookup key) */
  readonly id: SessionId;

  /** Customer this session authenticates (local user ID, deprecated in Phase 3F.3) */
  readonly customerId: CustomerId;

  /** Shopify customer ID (authoritative identity in Phase 3F.3+) */
  readonly shopifyCustomerId?: string;

  /** Shopify access token (server-side only, never exposed to browser) */
  readonly shopifyAccessToken?: string;

  /** Customer email (for audit/notifications) */
  readonly email: string;

  /** When this session was created */
  readonly createdAt: Date;

  /** Last activity timestamp (used for idle timeout) */
  lastActivityAt: Date;

  /** When this session will be revoked (absolute timeout) */
  readonly expiresAt: Date;

  /** Device/location context (optional audit trail) */
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

/**
 * Session configuration (should be externalized to env vars).
 */
export interface SessionConfig {
  /** Idle timeout in seconds (30 min default) */
  readonly idleTimeoutSeconds: number;

  /** Absolute timeout in seconds (24 hours default) */
  readonly absoluteTimeoutSeconds: number;

  /** Cookie name */
  readonly cookieName: string;

  /** Cookie domain (for multi-domain setups) */
  readonly cookieDomain?: string;

  /** Cookie path */
  readonly cookiePath: string;

  /** Whether to use Secure flag (HTTPS only) */
  readonly cookieSecure: boolean;

  /** SameSite policy (CSRF protection) */
  readonly cookieSameSite: 'strict' | 'lax' | 'none';
}

/**
 * Session creation parameters (what client provides).
 */
export interface CreateSessionInput {
  readonly customerId: CustomerId;
  readonly email: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

/**
 * Session refresh result (for extending idle timeout).
 */
export interface RefreshSessionResult {
  readonly ok: boolean;
  readonly session?: SessionRecord;
  readonly error?: string;
}

/**
 * Helper: Create a SessionId from a string.
 * In production, this would be a cryptographically secure token (e.g., nanoid).
 */
export function createSessionId(token: string): SessionId {
  return token as SessionId;
}

/**
 * Helper: Create a CustomerId from a string.
 */
export function createCustomerId(id: string): CustomerId {
  return id as CustomerId;
}

/**
 * Default session configuration for production.
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  idleTimeoutSeconds: 30 * 60, // 30 minutes
  absoluteTimeoutSeconds: 24 * 60 * 60, // 24 hours
  cookieName: 'session',
  cookiePath: '/',
  cookieSecure: true, // Set to false in development
  cookieSameSite: 'strict',
};
