/**
 * Session Service
 * Session management with token hashing
 *
 * Phase 2: Service implementation
 */

import crypto from 'crypto';
import { SessionRepository } from '../repositories/session.repository';
import { SessionEntity } from '../entities/session.entity';
import { ValidationError } from '../errors/app-error';

export class SessionService {
  private repository: SessionRepository;
  private readonly TOKEN_LENGTH = 32; // 64 hex chars after encoding
  private readonly SESSION_DURATION_HOURS = 24;

  constructor() {
    this.repository = new SessionRepository();
  }

  /**
   * Create a new session
   * Returns raw token (to send to client) and stored hash
   */
  async createSession(
    customerId: string,
    storeId: string,
    data: {
      ipAddress: string;
      userAgent?: string;
      deviceType?: string;
      deviceName?: string;
    }
  ): Promise<{ session: SessionEntity; token: string }> {
    // Generate raw token
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.SESSION_DURATION_HOURS);

    // Create session with hash
    const session = await this.repository.createSession(
      customerId,
      storeId,
      {
        tokenHash,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceType: data.deviceType,
        deviceName: data.deviceName,
        expiresAt,
      }
    );

    return {
      session,
      token: rawToken,
    };
  }

  /**
   * Verify session by JWT (used by middleware)
   * Looks up session by ID from JWT payload
   */
  async verifySessionById(sessionId: string, storeId: string): Promise<SessionEntity> {
    if (!sessionId) {
      throw new ValidationError('Session ID required');
    }

    const session = await this.repository.findById(sessionId, storeId);

    if (!session) {
      throw new ValidationError('Invalid or expired session');
    }

    // Check expiry
    if (session.expires_at < new Date()) {
      throw new ValidationError('Session expired');
    }

    // Update activity
    await this.repository.updateActivity(session.id, storeId);

    return session;
  }

  /**
   * Verify session by token
   * CRITICAL: Hash the provided token and compare hashes only
   */
  async verifySession(token: string, storeId: string): Promise<SessionEntity> {
    if (!token) {
      throw new ValidationError('Token required');
    }

    // Hash provided token
    const tokenHash = this.hashToken(token);

    // Find session by hash
    const session = await this.repository.findByTokenHash(tokenHash, storeId);

    if (!session) {
      throw new ValidationError('Invalid or expired session');
    }

    // Check expiry
    if (session.expires_at < new Date()) {
      throw new ValidationError('Session expired');
    }

    // Update activity
    await this.repository.updateActivity(session.id, storeId);

    return session;
  }

  /**
   * List active sessions for customer
   */
  async listActiveSessions(customerId: string, storeId: string): Promise<SessionEntity[]> {
    return this.repository.listActiveSessions(customerId, storeId);
  }

  /**
   * Logout (revoke single session)
   */
  async logout(sessionId: string, storeId: string): Promise<void> {
    await this.repository.revokeSession(sessionId, storeId);
  }

  /**
   * Logout everywhere (revoke all sessions for customer)
   */
  async logoutEverywhere(customerId: string, storeId: string): Promise<void> {
    await this.repository.revokeAllSessions(customerId, storeId);
  }

  /**
   * Generate random token
   * CRITICAL: Never log or return this except to client
   */
  private generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Hash token using SHA-256
   * CRITICAL: Only hashes are stored in database
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
