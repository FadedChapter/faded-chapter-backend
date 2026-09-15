/**
 * Password Reset Service
 * Handles password reset token generation, validation, and password updates
 * Phase 3F.5: Password reset system
 */

import { PasswordResetEntity } from '../entities/password-reset.entity';
import { UserEntity } from '../../user/entities/user.entity';
import { AppDataSource } from '../../database/data-source';
import { Repository, LessThan } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../../user/services/password-hashing.service';

export interface ResetTokenResult {
  token: string;
  expiresAt: Date;
  expiresInHours: number;
}

export interface ResetResult {
  ok: boolean;
  email?: string;
  resetAt?: Date;
  error?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  email?: string;
  expiresAt?: Date;
  expiresInSeconds?: number;
  error?: string;
}

export class PasswordResetService {
  private resetRepository: Repository<PasswordResetEntity>;
  private userRepository: Repository<UserEntity>;
  private readonly TOKEN_EXPIRY_HOURS = 24;
  private readonly RESET_RATE_LIMIT_MINUTES = 15; // Can request reset every 15 minutes
  private readonly MAX_RESET_ATTEMPTS = 3; // Max 3 password change attempts per token

  constructor() {
    this.resetRepository = AppDataSource.getRepository(PasswordResetEntity);
    this.userRepository = AppDataSource.getRepository(UserEntity);
  }

  /**
   * Generate a password reset token for a user
   */
  async generateResetToken(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ResetTokenResult> {
    try {
      // Invalidate any existing reset tokens for this user
      await this.resetRepository.update(
        { userId, isUsed: false },
        { isUsed: true, updatedAt: new Date() }
      );

      // Generate secure random token (32 bytes = 256 bits)
      const tokenBuffer = randomBytes(32);
      const token = tokenBuffer.toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Create reset record
      const reset = this.resetRepository.create({
        id: uuidv4(),
        userId,
        token,
        email,
        expiresAt,
        isUsed: false,
        attemptCount: 0,
        requestedAt: now,
        ipAddress,
        userAgent,
      });

      await this.resetRepository.save(reset);

      console.log(`[PasswordReset] ✅ Reset token generated for user ${userId}`);

      return {
        token,
        expiresAt,
        expiresInHours: this.TOKEN_EXPIRY_HOURS,
      };
    } catch (error) {
      console.error('[PasswordReset] ❌ Error generating reset token:', error);
      throw error;
    }
  }

  /**
   * Validate a reset token (check if valid without using it)
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const reset = await this.resetRepository.findOne({
        where: { token },
      });

      if (!reset) {
        console.warn('[PasswordReset] ⚠️ Token not found');
        return {
          valid: false,
          error: 'Invalid password reset link',
        };
      }

      // Token already used
      if (reset.isUsed) {
        console.warn('[PasswordReset] ⚠️ Token already used');
        return {
          valid: false,
          error: 'This password reset link has already been used',
        };
      }

      // Token expired
      if (reset.expiresAt < new Date()) {
        console.warn('[PasswordReset] ⚠️ Token expired');
        return {
          valid: false,
          error: 'This password reset link has expired. Please request a new one.',
        };
      }

      const now = new Date();
      const expiresInSeconds = Math.floor((reset.expiresAt.getTime() - now.getTime()) / 1000);

      return {
        valid: true,
        email: reset.email,
        expiresAt: reset.expiresAt,
        expiresInSeconds,
      };
    } catch (error) {
      console.error('[PasswordReset] ❌ Error validating token:', error);
      return {
        valid: false,
        error: 'Failed to validate reset link',
      };
    }
  }

  /**
   * Reset password with token and new password
   */
  async resetPassword(token: string, newPassword: string): Promise<ResetResult> {
    try {
      const reset = await this.resetRepository.findOne({
        where: { token },
      });

      // Token not found
      if (!reset) {
        console.warn('[PasswordReset] ⚠️ Token not found');
        return {
          ok: false,
          error: 'Invalid or expired password reset link',
        };
      }

      // Token already used
      if (reset.isUsed) {
        console.warn('[PasswordReset] ⚠️ Token already used');
        return {
          ok: false,
          error: 'This password reset link has already been used',
        };
      }

      // Token expired
      if (reset.expiresAt < new Date()) {
        console.warn('[PasswordReset] ⚠️ Token expired');
        return {
          ok: false,
          error: 'This password reset link has expired. Please request a new one.',
        };
      }

      // Check attempt limit
      if (reset.attemptCount >= this.MAX_RESET_ATTEMPTS) {
        console.warn('[PasswordReset] ⚠️ Too many reset attempts');
        return {
          ok: false,
          error: `Maximum password reset attempts (${this.MAX_RESET_ATTEMPTS}) exceeded. Please request a new reset link.`,
        };
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: reset.userId },
      });

      if (!user) {
        console.error('[PasswordReset] ❌ User not found');
        return {
          ok: false,
          error: 'User not found',
        };
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update user password
      const now = new Date();
      await this.userRepository.update(user.id, {
        passwordHash,
        updatedAt: now,
      });

      // Mark token as used
      await this.resetRepository.update(reset.id, {
        isUsed: true,
        usedAt: now,
        updatedAt: now,
      });

      console.log(`[PasswordReset] ✅ Password reset successfully for user ${reset.userId}`);

      return {
        ok: true,
        email: reset.email,
        resetAt: now,
      };
    } catch (error) {
      console.error('[PasswordReset] ❌ Error resetting password:', error);
      return {
        ok: false,
        error: 'Failed to reset password',
      };
    }
  }

  /**
   * Check if user can request a password reset (rate limiting)
   */
  async canRequestReset(userId: string): Promise<{
    can: boolean;
    reason?: string;
    nextResetAt?: Date;
  }> {
    try {
      // Get the most recent reset request
      const reset = await this.resetRepository.findOne({
        where: { userId },
        order: { requestedAt: 'DESC' },
      });

      if (!reset || !reset.requestedAt) {
        return { can: true }; // No existing reset request
      }

      // Check rate limit
      const now = new Date();
      const timeSinceLastRequest = now.getTime() - reset.requestedAt.getTime();
      const rateLimitMs = this.RESET_RATE_LIMIT_MINUTES * 60 * 1000;

      if (timeSinceLastRequest < rateLimitMs) {
        const nextResetAt = new Date(reset.requestedAt.getTime() + rateLimitMs);
        const minutesRemaining = Math.ceil(
          (nextResetAt.getTime() - now.getTime()) / 60000
        );

        return {
          can: false,
          reason: `Please wait ${minutesRemaining} minutes before requesting another password reset`,
          nextResetAt,
        };
      }

      return { can: true };
    } catch (error) {
      console.error('[PasswordReset] ❌ Error checking reset eligibility:', error);
      return { can: false, reason: 'Error checking reset eligibility' };
    }
  }

  /**
   * Record a password reset attempt
   */
  async recordResetAttempt(token: string): Promise<void> {
    try {
      const reset = await this.resetRepository.findOne({
        where: { token },
      });

      if (reset) {
        await this.resetRepository.update(reset.id, {
          attemptCount: reset.attemptCount + 1,
          updatedAt: new Date(),
        });

        console.log(
          `[PasswordReset] 🔄 Reset attempt ${reset.attemptCount + 1} for token`
        );
      }
    } catch (error) {
      console.error('[PasswordReset] ❌ Error recording reset attempt:', error);
    }
  }

  /**
   * Clean up expired reset tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await this.resetRepository.delete({
        updatedAt: LessThan(thirtyDaysAgo),
      });

      const count = result.affected || 0;
      if (count > 0) {
        console.log(`[PasswordReset] 🧹 Cleaned up ${count} expired reset tokens`);
      }

      return count;
    } catch (error) {
      console.error('[PasswordReset] ❌ Error cleaning up expired tokens:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const passwordResetService = new PasswordResetService();
