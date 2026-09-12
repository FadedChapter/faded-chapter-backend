/**
 * SessionStore Port
 *
 * Defines the contract that any session storage implementation must satisfy.
 * This is the boundary between the authentication layer and persistence.
 *
 * Implementations:
 * - Development: in-memory (inmemory-session-store.ts)
 * - Production: database-backed (to be implemented)
 *
 * Architecture:
 * The port does NOT define HOW sessions are persisted.
 * Implementations are free to use memory, files, databases, or distributed caches.
 * The contract ensures all implementations provide the same guarantees.
 */

import {
  SessionRecord,
  CustomerId,
  SessionId,
  CreateSessionInput,
  RefreshSessionResult,
} from './session.types';

/**
 * Session storage abstraction.
 * Implement this to provide session persistence.
 */
export interface SessionStore {
  /**
   * Create a new session for an authenticated customer.
   *
   * @param input Customer ID, email, and optional context
   * @returns New session record with generated ID
   */
  create(input: CreateSessionInput): Promise<SessionRecord>;

  /**
   * Retrieve a session by ID.
   *
   * @param sessionId The opaque session token
   * @returns Session record if found and valid, null if expired/revoked/not found
   *
   * Security: Returns null for expired sessions (server enforces expiry).
   * Calling code should not trust client-side expiry calculations.
   */
  get(sessionId: SessionId): Promise<SessionRecord | null>;

  /**
   * Refresh a session's idle timeout (extend lastActivityAt).
   *
   * Called on every authenticated request to keep session alive.
   * This allows long-lived sessions if the customer is active.
   *
   * @param sessionId The opaque session token
   * @returns Updated session or null if expired/revoked
   */
  refresh(sessionId: SessionId): Promise<RefreshSessionResult>;

  /**
   * Destroy a specific session (logout).
   *
   * @param sessionId The opaque session token
   */
  destroy(sessionId: SessionId): Promise<void>;

  /**
   * Destroy all sessions for a customer (security event: password change, account compromise).
   *
   * @param customerId Customer to revoke all sessions for
   */
  destroyAllForCustomer(customerId: CustomerId): Promise<void>;

  /**
   * Check if a session is valid without retrieving the full record.
   * Useful for authorization checks that only need to know "is authenticated?".
   *
   * @param sessionId The opaque session token
   * @returns true if session exists and is not expired, false otherwise
   */
  isValid(sessionId: SessionId): Promise<boolean>;
}

/**
 * Dependency injection token for SessionStore.
 * Used in Express configuration to wire up the store implementation.
 */
export const SESSION_STORE = Symbol.for('SessionStore');
