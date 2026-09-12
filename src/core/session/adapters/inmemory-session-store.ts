/**
 * Development-Only In-Memory Session Store
 *
 * ⚠️ NOT FOR PRODUCTION
 *
 * This is a temporary development implementation.
 * For production, implement a database-backed store (PostgreSQL, MongoDB, etc.)
 * that provides durability and supports distributed deployments.
 *
 * This implementation:
 * - Loses all sessions on server restart
 * - Does not scale to multiple processes
 * - Keeps all sessions in memory (no GC)
 * - Is acceptable for local development only
 *
 * To replace:
 * 1. Create DatabaseSessionStore implements SessionStore
 * 2. Update Express configuration to wire the database store
 * 3. Remove this file
 */

import {
  SessionRecord,
  CustomerId,
  SessionId,
  CreateSessionInput,
  RefreshSessionResult,
  createSessionId,
  DEFAULT_SESSION_CONFIG,
} from '../session.types';
import { SessionStore } from '../session-store.port';
import { randomBytes } from 'node:crypto';

/**
 * Development-only session store (in-memory, no persistence).
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly customerSessions = new Map<string, Set<string>>(); // customer -> session IDs

  constructor(private readonly config = DEFAULT_SESSION_CONFIG) {
    console.warn(
      '[Session] Using in-memory store. This is DEVELOPMENT ONLY and will lose all sessions on restart.',
    );
  }

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    // Generate cryptographically secure session token
    const token = randomBytes(32).toString('hex');
    const sessionId = createSessionId(token);

    const now = new Date();
    const session: SessionRecord = {
      id: sessionId,
      customerId: input.customerId,
      email: input.email,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + this.config.absoluteTimeoutSeconds * 1000),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    };

    this.sessions.set(token, session);

    // Track customer -> sessions mapping for revokeAllForCustomer
    const customerSessions = this.customerSessions.get(input.customerId);
    if (customerSessions) {
      customerSessions.add(token);
    } else {
      this.customerSessions.set(input.customerId, new Set([token]));
    }

    console.log(`[Session] Created session ${sessionId.substring(0, 8)}... for ${input.email}`);
    return session;
  }

  async get(sessionId: SessionId): Promise<SessionRecord | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null; // Not found
    }

    // Check expiry (both absolute and idle)
    const now = new Date();

    // Absolute timeout
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.removeCustumerSession(session.customerId, sessionId);
      return null; // Expired
    }

    // Idle timeout
    const idleMs = now.getTime() - session.lastActivityAt.getTime();
    if (idleMs > this.config.idleTimeoutSeconds * 1000) {
      this.sessions.delete(sessionId);
      this.removeCustumerSession(session.customerId, sessionId);
      return null; // Idle timeout
    }

    return session;
  }

  async refresh(sessionId: SessionId): Promise<RefreshSessionResult> {
    const session = await this.get(sessionId);

    if (!session) {
      return { ok: false, error: 'Session not found or expired' };
    }

    // Update last activity to extend idle timeout
    session.lastActivityAt = new Date();

    return { ok: true, session };
  }

  async destroy(sessionId: SessionId): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      this.sessions.delete(sessionId);
      this.removeCustumerSession(session.customerId, sessionId);
      console.log(`[Session] Destroyed session ${sessionId.substring(0, 8)}...`);
    }
  }

  async destroyAllForCustomer(customerId: CustomerId): Promise<void> {
    const sessionIds = this.customerSessions.get(customerId);

    if (sessionIds) {
      for (const sessionId of sessionIds) {
        this.sessions.delete(sessionId);
      }
      this.customerSessions.delete(customerId);
      console.log(`[Session] Destroyed all sessions for customer ${customerId}`);
    }
  }

  async isValid(sessionId: SessionId): Promise<boolean> {
    const session = await this.get(sessionId);
    return session !== null;
  }

  /**
   * Get all active sessions (for debugging/admin only).
   * This should NOT be exposed via API.
   */
  getAllSessions(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }

  private removeCustumerSession(customerId: CustomerId, sessionId: string): void {
    const sessions = this.customerSessions.get(customerId);
    if (sessions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) {
        this.customerSessions.delete(customerId);
      }
    }
  }
}
