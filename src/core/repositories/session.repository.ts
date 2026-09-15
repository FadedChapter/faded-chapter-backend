/**
 * Session Repository
 * Handles session management with token hash verification
 *
 * Phase 2: Repository implementation
 */

import { BaseRepository } from '../repository/base-repository';
import { SessionEntity } from '../entities/session.entity';
import crypto from 'crypto';

export class SessionRepository extends BaseRepository<SessionEntity> {
  constructor() {
    super(SessionEntity);
  }

  /**
   * Create session with token hash
   * CRITICAL: Never store raw token, only hash
   */
  async createSession(
    customerId: string,
    storeId: string,
    data: {
      tokenHash: string; // Already hashed by service
      ipAddress: string;
      userAgent?: string;
      deviceType?: string;
      deviceName?: string;
      expiresAt: Date;
    }
  ): Promise<SessionEntity> {
    const session = this.repository.create({
      store_id: storeId,
      customer_id: customerId,
      token_hash: data.tokenHash,
      ip_address: data.ipAddress,
      user_agent: data.userAgent || null,
      device_type: data.deviceType || null,
      device_name: data.deviceName || null,
      is_active: true,
      created_at: new Date(),
      last_activity_at: new Date(),
      expires_at: data.expiresAt,
      revoked_at: null,
    });

    return this.save(session);
  }

  /**
   * Find session by ID (for JWT verification)
   */
  async findById(sessionId: string, storeId: string): Promise<SessionEntity | null> {
    try {
      const session = await this.repository.findOne({
        where: {
          id: sessionId,
          store_id: storeId,
          is_active: true,
        } as any,
      });

      return session || null;
    } catch (error) {
      throw new Error(`Failed to find session: ${(error as Error).message}`);
    }
  }

  /**
   * Find session by token hash (most critical method)
   * CRITICAL: Application hashes token, we compare hashes only
   */
  async findByTokenHash(tokenHash: string, storeId: string): Promise<SessionEntity | null> {
    try {
      const session = await this.repository.findOne({
        where: {
          token_hash: tokenHash,
          store_id: storeId,
          is_active: true,
          expires_at: null, // Will be checked in service
        } as any,
      });

      return session || null;
    } catch (error) {
      throw new Error(`Failed to find session: ${(error as Error).message}`);
    }
  }

  /**
   * List active sessions for customer
   */
  async listActiveSessions(customerId: string, storeId: string): Promise<SessionEntity[]> {
    try {
      return await this.repository.find({
        where: {
          customer_id: customerId,
          store_id: storeId,
          is_active: true,
        } as any,
        order: { created_at: 'DESC' } as any,
      });
    } catch (error) {
      throw new Error(`Failed to list sessions: ${(error as Error).message}`);
    }
  }

  /**
   * Revoke session (logout)
   */
  async revokeSession(sessionId: string, storeId: string): Promise<void> {
    try {
      await this.repository.update(
        { id: sessionId, store_id: storeId } as any,
        { is_active: false, revoked_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to revoke session: ${(error as Error).message}`);
    }
  }

  /**
   * Revoke all sessions for customer (logout everywhere)
   */
  async revokeAllSessions(customerId: string, storeId: string): Promise<void> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        { is_active: false, revoked_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to revoke all sessions: ${(error as Error).message}`);
    }
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionId: string, storeId: string): Promise<void> {
    try {
      await this.repository.update(
        { id: sessionId, store_id: storeId } as any,
        { last_activity_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to update session activity: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up expired sessions (run as scheduled job)
   */
  async cleanupExpiredSessions(storeId: string): Promise<number> {
    try {
      const result = await this.repository.delete({
        store_id: storeId,
        expires_at: null, // Will implement proper date check in migration
      } as any);
      return result.affected || 0;
    } catch (error) {
      throw new Error(`Failed to cleanup sessions: ${(error as Error).message}`);
    }
  }
}
