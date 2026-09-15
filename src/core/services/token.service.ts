/**
 * Token Service
 * Verification tokens and password reset tokens
 *
 * Phase 2: Service implementation
 */

import crypto from 'crypto';
import { VerificationTokenRepository, PasswordResetTokenRepository } from '../repositories/token.repository';
import { VerificationTokenEntity } from '../entities/verification-token.entity';
import { PasswordResetTokenEntity } from '../entities/password-reset-token.entity';
import { ValidationError, ConflictError } from '../errors/app-error';

export class TokenService {
  private verificationTokenRepo: VerificationTokenRepository;
  private passwordResetTokenRepo: PasswordResetTokenRepository;
  private readonly TOKEN_LENGTH = 32; // 64 hex chars
  private readonly TOKEN_EXPIRY_HOURS = 24;

  constructor() {
    this.verificationTokenRepo = new VerificationTokenRepository();
    this.passwordResetTokenRepo = new PasswordResetTokenRepository();
  }

  // ============================================================================
  // Verification Tokens
  // ============================================================================

  /**
   * Create email verification token
   */
  async createVerificationToken(
    customerId: string,
    storeId: string,
    email: string
  ): Promise<{ token: string; entity: VerificationTokenEntity }> {
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    const entity = await this.verificationTokenRepo.createToken(
      customerId,
      storeId,
      email,
      tokenHash,
      expiresAt
    );

    return { token: rawToken, entity };
  }

  /**
   * Verify email token
   */
  async verifyEmailToken(token: string, storeId: string): Promise<VerificationTokenEntity> {
    if (!token) {
      throw new ValidationError('Verification token required');
    }

    const tokenHash = this.hashToken(token);
    const tokenEntity = await this.verificationTokenRepo.findValidToken(tokenHash, storeId);

    if (!tokenEntity) {
      throw new ValidationError('Invalid or expired verification token');
    }

    // Mark as consumed (one-time use)
    await this.verificationTokenRepo.consumeToken(tokenHash, storeId);

    return tokenEntity;
  }

  // ============================================================================
  // Password Reset Tokens
  // ============================================================================

  /**
   * Create password reset token
   */
  async createPasswordResetToken(
    customerId: string,
    storeId: string,
    email: string,
    requestedIp: string
  ): Promise<{ token: string; entity: PasswordResetTokenEntity }> {
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    const entity = await this.passwordResetTokenRepo.createToken(
      customerId,
      storeId,
      email,
      tokenHash,
      expiresAt,
      requestedIp
    );

    return { token: rawToken, entity };
  }

  /**
   * Verify password reset token
   * Includes brute-force protection
   */
  async verifyPasswordResetToken(token: string, storeId: string): Promise<PasswordResetTokenEntity> {
    if (!token) {
      throw new ValidationError('Reset token required');
    }

    const tokenHash = this.hashToken(token);
    const tokenEntity = await this.passwordResetTokenRepo.findValidToken(tokenHash, storeId);

    if (!tokenEntity) {
      // Increment attempt even on invalid token
      await this.passwordResetTokenRepo.incrementAttempt(tokenHash, storeId);
      throw new ValidationError('Invalid or expired reset token');
    }

    return tokenEntity;
  }

  /**
   * Consume password reset token
   */
  async consumePasswordResetToken(
    token: string,
    storeId: string,
    usedIp: string
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.passwordResetTokenRepo.consumeToken(tokenHash, storeId, usedIp);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Generate random token
   * CRITICAL: Never log or return except to client
   */
  private generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Hash token using SHA-256
   * CRITICAL: Only hashes stored in database
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
