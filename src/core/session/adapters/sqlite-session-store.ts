/**
 * SQLite Session Store (TypeORM Adapter)
 * Replaces InMemorySessionStore with persistent SQLite storage
 * Implements SessionStore interface for ports-and-adapters pattern
 * Phase 3F.1: Session management with database persistence
 */

import {
  SessionRecord,
  CustomerId,
  SessionId,
  CreateSessionInput,
  RefreshSessionResult,
  createSessionId,
  DEFAULT_SESSION_CONFIG,
  SessionConfig,
} from '../session.types';
import { SessionStore } from '../session-store.port';
import { SessionEntity } from '../entities/session.entity';
import { AppDataSource } from '../../database/data-source';
import { Repository, LessThan } from 'typeorm';
import { randomBytes } from 'node:crypto';

export class SqliteSessionStore implements SessionStore {
  private sessionRepository: Repository<SessionEntity>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly config: SessionConfig = DEFAULT_SESSION_CONFIG) {
    this.sessionRepository = AppDataSource.getRepository(SessionEntity);
    this.startCleanupInterval();
    console.log('[Session] ✅ Using SQLite persistent session store');
  }

  /**
   * Create a new session for an authenticated user
   */
  async create(input: CreateSessionInput): Promise<SessionRecord> {
    try {
      const token = randomBytes(32).toString('hex');
      const sessionId = createSessionId(token);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.absoluteTimeoutSeconds * 1000);

      const entity = this.sessionRepository.create({
        id: token,
        userId: input.customerId,
        expiresAt,
      });

      await this.sessionRepository.save(entity);

      const session: SessionRecord = {
        id: sessionId,
        customerId: input.customerId,
        email: input.email,
        createdAt: now,
        lastActivityAt: now,
        expiresAt,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      };

      console.log(`[Session] ✅ Created session for ${input.email}`);
      return session;
    } catch (error) {
      console.error('[Session] ❌ Error creating session:', error);
      throw error;
    }
  }

  /**
   * Retrieve a session by ID
   */
  async get(sessionId: SessionId): Promise<SessionRecord | null> {
    try {
      const entity = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });

      if (!entity) {
        return null; // Not found
      }

      // Check if expired
      const now = new Date();
      if (entity.expiresAt < now) {
        await this.sessionRepository.delete(sessionId);
        return null; // Expired
      }

      // For now, we're not implementing idle timeout in SQLite version
      // That can be added later with an updatedAt timestamp
      const session: SessionRecord = {
        id: sessionId,
        customerId: entity.userId as CustomerId,
        email: entity.email ?? '', // Parse from stored data if available
        createdAt: entity.createdAt,
        lastActivityAt: entity.updatedAt,
        expiresAt: entity.expiresAt,
      };

      return session;
    } catch (error) {
      console.error('[Session] ❌ Error getting session:', error);
      return null;
    }
  }

  /**
   * Refresh a session's idle timeout
   */
  async refresh(sessionId: SessionId): Promise<RefreshSessionResult> {
    try {
      const session = await this.get(sessionId);

      if (!session) {
        return { ok: false, error: 'Session not found or expired' };
      }

      // Update lastActivityAt by touching the updatedAt timestamp
      await this.sessionRepository.update(sessionId, {
        updatedAt: new Date(),
      });

      // Return updated session
      const updated = await this.get(sessionId);
      return {
        ok: true,
        session: updated ?? undefined,
      };
    } catch (error) {
      console.error('[Session] ❌ Error refreshing session:', error);
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Destroy a specific session
   */
  async destroy(sessionId: SessionId): Promise<void> {
    try {
      await this.sessionRepository.delete(sessionId);
      console.log(`[Session] ✅ Destroyed session`);
    } catch (error) {
      console.error('[Session] ❌ Error destroying session:', error);
    }
  }

  /**
   * Destroy all sessions for a customer
   */
  async destroyAllForCustomer(customerId: CustomerId): Promise<void> {
    try {
      const result = await this.sessionRepository.delete({
        userId: customerId,
      });
      if (result.affected && result.affected > 0) {
        console.log(
          `[Session] ✅ Destroyed ${result.affected} sessions for customer ${customerId}`,
        );
      }
    } catch (error) {
      console.error('[Session] ❌ Error destroying sessions:', error);
    }
  }

  /**
   * Check if a session is valid
   */
  async isValid(sessionId: SessionId): Promise<boolean> {
    try {
      const session = await this.get(sessionId);
      return session !== null;
    } catch (error) {
      console.error('[Session] ❌ Error checking session validity:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   * Runs periodically to remove old sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      const result = await this.sessionRepository.delete({
        expiresAt: LessThan(now),
      });

      if (result.affected && result.affected > 0) {
        console.log(`[Session] 🧹 Cleaned up ${result.affected} expired sessions`);
      }
    } catch (error) {
      console.error('[Session] ❌ Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Start background cleanup interval (every 1 hour)
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), CLEANUP_INTERVAL);
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
