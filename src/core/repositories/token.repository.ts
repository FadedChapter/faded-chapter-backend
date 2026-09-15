/**
 * Token Repositories
 * Verification and password reset tokens
 *
 * Phase 2: Repository implementation
 */

import { BaseRepository } from '../repository/base-repository';
import { VerificationTokenEntity } from '../entities/verification-token.entity';
import { PasswordResetTokenEntity } from '../entities/password-reset-token.entity';

/**
 * Verification Token Repository
 * One-time email verification tokens (24h expiry)
 */
export class VerificationTokenRepository extends BaseRepository<VerificationTokenEntity> {
  constructor() {
    super(VerificationTokenEntity);
  }

  /**
   * Find by token hash and verify not consumed
   * CRITICAL: Application hashes token, we compare hashes only
   */
  async findValidToken(tokenHash: string, storeId: string): Promise<VerificationTokenEntity | null> {
    try {
      const token = await this.repository.findOne({
        where: {
          token_hash: tokenHash,
          store_id: storeId,
          consumed_at: null,
        } as any,
      });

      if (!token) return null;

      // Check not expired
      if (token.expires_at < new Date()) {
        return null;
      }

      return token;
    } catch (error) {
      throw new Error(`Failed to find verification token: ${(error as Error).message}`);
    }
  }

  /**
   * Create verification token
   */
  async createToken(
    customerId: string,
    storeId: string,
    email: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<VerificationTokenEntity> {
    const token = this.repository.create({
      store_id: storeId,
      customer_id: customerId,
      token_hash: tokenHash,
      purpose: 'email_verification',
      email,
      consumed_at: null,
      created_at: new Date(),
      expires_at: expiresAt,
    });

    return this.save(token);
  }

  /**
   * Mark token as consumed (one-time use)
   */
  async consumeToken(tokenHash: string, storeId: string): Promise<void> {
    try {
      await this.repository.update(
        { token_hash: tokenHash, store_id: storeId } as any,
        { consumed_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to consume token: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up expired tokens (run as scheduled job)
   */
  async cleanupExpiredTokens(storeId: string): Promise<number> {
    try {
      const result = await this.repository.delete({
        store_id: storeId,
        expires_at: null, // Will implement proper date check in migration
      } as any);
      return result.affected || 0;
    } catch (error) {
      throw new Error(`Failed to cleanup tokens: ${(error as Error).message}`);
    }
  }
}

/**
 * Password Reset Token Repository
 * One-time password reset tokens with brute-force protection
 */
export class PasswordResetTokenRepository extends BaseRepository<PasswordResetTokenEntity> {
  constructor() {
    super(PasswordResetTokenEntity);
  }

  /**
   * Find by token hash with validation
   * CRITICAL: Check attempt count before allowing use
   */
  async findValidToken(tokenHash: string, storeId: string): Promise<PasswordResetTokenEntity | null> {
    try {
      const token = await this.repository.findOne({
        where: {
          token_hash: tokenHash,
          store_id: storeId,
          consumed_at: null,
        } as any,
      });

      if (!token) return null;

      // Check not expired
      if (token.expires_at < new Date()) {
        return null;
      }

      // Check not exceeded max attempts
      if (token.attempt_count >= token.max_attempts) {
        return null;
      }

      return token;
    } catch (error) {
      throw new Error(`Failed to find reset token: ${(error as Error).message}`);
    }
  }

  /**
   * Create password reset token
   */
  async createToken(
    customerId: string,
    storeId: string,
    email: string,
    tokenHash: string,
    expiresAt: Date,
    requestedIp: string
  ): Promise<PasswordResetTokenEntity> {
    const token = this.repository.create({
      store_id: storeId,
      customer_id: customerId,
      token_hash: tokenHash,
      email,
      consumed_at: null,
      created_at: new Date(),
      expires_at: expiresAt,
      attempt_count: 0,
      max_attempts: 3,
      requested_ip_address: requestedIp,
      used_ip_address: null,
    });

    return this.save(token);
  }

  /**
   * Increment attempt counter for brute-force protection
   */
  async incrementAttempt(tokenHash: string, storeId: string): Promise<void> {
    try {
      const token = await this.repository.findOne({
        where: { token_hash: tokenHash, store_id: storeId } as any,
      });

      if (token) {
        await this.repository.update(
          { token_hash: tokenHash, store_id: storeId } as any,
          { attempt_count: token.attempt_count + 1 }
        );
      }
    } catch (error) {
      throw new Error(`Failed to increment attempt: ${(error as Error).message}`);
    }
  }

  /**
   * Mark token as used
   */
  async consumeToken(tokenHash: string, storeId: string, usedIp: string): Promise<void> {
    try {
      await this.repository.update(
        { token_hash: tokenHash, store_id: storeId } as any,
        { consumed_at: new Date(), used_ip_address: usedIp }
      );
    } catch (error) {
      throw new Error(`Failed to consume token: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(storeId: string): Promise<number> {
    try {
      const result = await this.repository.delete({
        store_id: storeId,
        expires_at: null, // Will implement proper date check in migration
      } as any);
      return result.affected || 0;
    } catch (error) {
      throw new Error(`Failed to cleanup tokens: ${(error as Error).message}`);
    }
  }
}
