/**
 * Password Reset Routes
 * Handles password reset flow (forgot password, validate token, reset password)
 * Phase 3F.5: Password reset system
 */

import { Router, Request, Response } from 'express';
import { passwordResetService } from '../core/password/services/password-reset.service';
import { emailSender, EmailTemplateBuilder } from '../core/email/services/email-sender.service';
import { AppDataSource } from '../core/database/data-source';
import { UserEntity } from '../core/user/entities/user.entity';
import { normalizeEmail } from '../core/user/utils/email.util';

export function createPasswordRoutes(): Router {
  const router = Router();
  const userRepository = AppDataSource.getRepository(UserEntity);

  /**
   * POST /api/password/forgot
   * Request password reset (sends email with reset link)
   *
   * Request: { email }
   * Response: { ok: true, data: { email } }
   */
  router.post('/forgot', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'invalidRequest',
            message: 'Email is required',
          },
        });
      }

      const normalizedEmail = normalizeEmail(email);

      // Find user
      const user = await userRepository.findOne({
        where: { email: normalizedEmail },
      });

      // Don't reveal if email exists (security best practice)
      if (!user) {
        return res.json({
          ok: true,
          data: {
            email,
            message: 'If this email is registered, a password reset link will be sent shortly',
          },
        });
      }

      // Check rate limiting
      const canReset = await passwordResetService.canRequestReset(user.id);
      if (!canReset.can) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'rateLimited',
            message: canReset.reason,
            nextResetAt: canReset.nextResetAt,
          },
        });
      }

      // Generate reset token
      const ipAddress = req.ip || undefined;
      const userAgent = req.get('user-agent') || undefined;
      const tokenResult = await passwordResetService.generateResetToken(
        user.id,
        user.email,
        ipAddress,
        userAgent
      );

      // Send password reset email
      const emailPayload = EmailTemplateBuilder.buildPasswordResetEmail(user.email, tokenResult.token);
      const sendResult = await emailSender.send(emailPayload);

      if (!sendResult.ok) {
        console.error('[PasswordReset] ❌ Failed to send reset email');
        return res.status(500).json({
          ok: false,
          error: {
            code: 'emailSendFailed',
            message: 'Failed to send password reset email',
          },
        });
      }

      console.log(`[PasswordReset] ✅ Password reset email sent to ${user.email}`);

      // Return generic success response
      return res.json({
        ok: true,
        data: {
          email: normalizedEmail,
          message: 'Password reset link sent to your email address',
        },
      });
    } catch (error) {
      console.error('[PasswordReset] ❌ Error requesting password reset:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'internalError',
          message: 'Failed to process password reset request',
        },
      });
    }
  });

  /**
   * GET /api/password/reset-token-status
   * Validate reset token (check if valid)
   *
   * Request: ?token=...
   * Response: { ok: true, data: { valid, email, expiresAt, expiresInSeconds } }
   */
  router.get('/reset-token-status', async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'invalidRequest',
            message: 'Reset token is required',
          },
        });
      }

      // Validate token
      const validation = await passwordResetService.validateToken(token);

      return res.json({
        ok: true,
        data: {
          valid: validation.valid,
          email: validation.email,
          expiresAt: validation.expiresAt,
          expiresInSeconds: validation.expiresInSeconds,
          error: validation.error,
        },
      });
    } catch (error) {
      console.error('[PasswordReset] ❌ Error validating token:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'internalError',
          message: 'Failed to validate reset token',
        },
      });
    }
  });

  /**
   * POST /api/password/reset
   * Reset password with token
   *
   * Request: { token, newPassword, confirmPassword }
   * Response: { ok: true, data: { email, resetAt } }
   */
  router.post('/reset', async (req: Request, res: Response) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      // Validate inputs
      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'invalidRequest',
            message: 'Reset token is required',
          },
        });
      }

      if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'invalidRequest',
            message: 'New password is required',
          },
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'passwordMismatch',
            message: 'Passwords do not match',
          },
        });
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d!@#$%^&*]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'weakPassword',
            message: 'Password must be at least 8 characters with uppercase, lowercase, and number/symbol',
          },
        });
      }

      // Record attempt before trying to reset
      await passwordResetService.recordResetAttempt(token);

      // Reset password
      const result = await passwordResetService.resetPassword(token, newPassword);

      if (!result.ok) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'resetFailed',
            message: result.error,
          },
        });
      }

      console.log(`[PasswordReset] ✅ Password reset successful for ${result.email}`);

      return res.json({
        ok: true,
        data: {
          email: result.email,
          resetAt: result.resetAt,
          message: 'Password reset successfully. You can now login with your new password.',
        },
      });
    } catch (error) {
      console.error('[PasswordReset] ❌ Error resetting password:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'internalError',
          message: 'Failed to reset password',
        },
      });
    }
  });

  return router;
}
