/**
 * Email Verification Service
 * Handles email verification token generation, validation, and tracking
 * Phase 3F.4: Email verification system
 */

import { EmailVerificationEntity } from '../entities/email-verification.entity';
import { AppDataSource } from '../../database/data-source';
import { Repository, LessThan } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

export interface VerificationTokenResult {
  token: string;
  expiresAt: Date;
  expiresInHours: number;
}

export interface VerificationResult {
  ok: boolean;
  email?: string;
  verifiedAt?: Date;
  error?: string;
}

export class EmailVerificationService {
  private verificationRepository: Repository<EmailVerificationEntity>;
  private readonly TOKEN_EXPIRY_HOURS = 24;
  private readonly RESEND_RATE_LIMIT_MINUTES = 5; // Can resend every 5 minutes
  private readonly MAX_RESEND_ATTEMPTS = 5; // Max 5 resend attempts per verification

  constructor() {
    this.verificationRepository = AppDataSource.getRepository(EmailVerificationEntity);
  }

  /**
   * Generate a new verification token for a user
   */
  async generateVerificationToken(userId: string, email: string): Promise<VerificationTokenResult> {
    try {
      // Invalidate any existing verification tokens for this user
      await this.verificationRepository.update(
        { userId, isUsed: false },
        { isUsed: true, updatedAt: new Date() }
      );

      // Generate secure random token (32 bytes = 256 bits)
      const tokenBuffer = randomBytes(32);
      const token = tokenBuffer.toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Create verification record
      const verification = this.verificationRepository.create({
        id: uuidv4(),
        userId,
        token,
        email,
        expiresAt,
        isUsed: false,
        attemptCount: 1,
        lastSentAt: now,
      });

      await this.verificationRepository.save(verification);

      console.log(`[EmailVerification] ✅ Token generated for user ${userId}`);

      return {
        token,
        expiresAt,
        expiresInHours: this.TOKEN_EXPIRY_HOURS,
      };
    } catch (error) {
      console.error('[EmailVerification] ❌ Error generating token:', error);
      throw error;
    }
  }

  /**
   * Verify an email with a token
   */
  async verifyEmail(token: string): Promise<VerificationResult> {
    try {
      const verification = await this.verificationRepository.findOne({
        where: { token },
      });

      // Token not found
      if (!verification) {
        console.warn('[EmailVerification] ⚠️ Token not found');
        return {
          ok: false,
          error: 'Invalid or expired verification token',
        };
      }

      // Token already used
      if (verification.isUsed) {
        console.warn('[EmailVerification] ⚠️ Token already used');
        return {
          ok: false,
          error: 'This verification link has already been used',
        };
      }

      // Token expired
      if (verification.expiresAt < new Date()) {
        console.warn('[EmailVerification] ⚠️ Token expired');
        return {
          ok: false,
          error: 'This verification link has expired. Please request a new one.',
        };
      }

      // Mark token as used and record verification time
      const now = new Date();
      await this.verificationRepository.update(token, {
        isUsed: true,
        verifiedAt: now,
        updatedAt: now,
      });

      console.log(`[EmailVerification] ✅ Email verified for user ${verification.userId}`);

      return {
        ok: true,
        email: verification.email,
        verifiedAt: now,
      };
    } catch (error) {
      console.error('[EmailVerification] ❌ Error verifying email:', error);
      return {
        ok: false,
        error: 'Failed to verify email',
      };
    }
  }

  /**
   * Check if an email can be resent (rate limiting)
   */
  async canResendVerification(userId: string): Promise<{
    can: boolean;
    reason?: string;
    nextResendAt?: Date;
  }> {
    try {
      // Get the most recent unverified verification record
      const verification = await this.verificationRepository.findOne({
        where: { userId, isUsed: false },
        order: { createdAt: 'DESC' },
      });

      if (!verification) {
        return { can: true }; // No existing verification
      }

      // Check resend attempt limit
      if (verification.attemptCount >= this.MAX_RESEND_ATTEMPTS) {
        return {
          can: false,
          reason: `Maximum resend attempts (${this.MAX_RESEND_ATTEMPTS}) reached. Try again later.`,
        };
      }

      // Check rate limit (5 minute cooldown)
      if (verification.lastSentAt) {
        const now = new Date();
        const timeSinceLastSent = now.getTime() - verification.lastSentAt.getTime();
        const rateLimitMs = this.RESEND_RATE_LIMIT_MINUTES * 60 * 1000;

        if (timeSinceLastSent < rateLimitMs) {
          const nextResendAt = new Date(
            verification.lastSentAt.getTime() + rateLimitMs
          );
          return {
            can: false,
            reason: `Please wait ${this.RESEND_RATE_LIMIT_MINUTES} minutes before requesting another verification email`,
            nextResendAt,
          };
        }
      }

      return { can: true };
    } catch (error) {
      console.error('[EmailVerification] ❌ Error checking resend eligibility:', error);
      return { can: false, reason: 'Error checking resend eligibility' };
    }
  }

  /**
   * Increment resend attempt count
   */
  async recordResendAttempt(userId: string): Promise<void> {
    try {
      const verification = await this.verificationRepository.findOne({
        where: { userId, isUsed: false },
        order: { createdAt: 'DESC' },
      });

      if (verification) {
        await this.verificationRepository.update(verification.id, {
          attemptCount: verification.attemptCount + 1,
          lastSentAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(
          `[EmailVerification] 📧 Resend attempt ${verification.attemptCount + 1} for user ${userId}`
        );
      }
    } catch (error) {
      console.error('[EmailVerification] ❌ Error recording resend attempt:', error);
    }
  }

  /**
   * Get verification status for a user
   */
  async getVerificationStatus(userId: string): Promise<{
    verified: boolean;
    pendingEmail?: string;
    expiresAt?: Date;
    attemptCount?: number;
    nextResendAt?: Date;
  }> {
    try {
      // Get most recent unverified verification
      const verification = await this.verificationRepository.findOne({
        where: { userId, isUsed: false },
        order: { createdAt: 'DESC' },
      });

      if (!verification) {
        return { verified: false }; // No pending verification
      }

      // Check if token is still valid
      if (verification.expiresAt < new Date()) {
        return { verified: false }; // Token expired, no pending
      }

      // Calculate next resend time
      let nextResendAt: Date | undefined;
      if (verification.lastSentAt) {
        const rateLimitMs = this.RESEND_RATE_LIMIT_MINUTES * 60 * 1000;
        nextResendAt = new Date(verification.lastSentAt.getTime() + rateLimitMs);
        if (nextResendAt < new Date()) {
          nextResendAt = undefined; // Can resend now
        }
      }

      return {
        verified: false,
        pendingEmail: verification.email,
        expiresAt: verification.expiresAt,
        attemptCount: verification.attemptCount,
        nextResendAt,
      };
    } catch (error) {
      console.error('[EmailVerification] ❌ Error getting verification status:', error);
      return { verified: false };
    }
  }

  /**
   * Clean up expired verification tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await this.verificationRepository.delete({
        updatedAt: LessThan(thirtyDaysAgo),
      });

      const count = result.affected || 0;
      if (count > 0) {
        console.log(`[EmailVerification] 🧹 Cleaned up ${count} expired verification tokens`);
      }

      return count;
    } catch (error) {
      console.error('[EmailVerification] ❌ Error cleaning up expired tokens:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const emailVerificationService = new EmailVerificationService();
