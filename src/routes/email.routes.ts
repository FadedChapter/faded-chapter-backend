/**
 * Email Verification Routes
 * Handles email verification and resend endpoints
 * Phase 3F.4: Email verification system
 */

import { Router, Request, Response } from 'express';
import { emailVerificationService } from '../core/email/services/email-verification.service';
import { emailSender, EmailTemplateBuilder } from '../core/email/services/email-sender.service';
import { AppDataSource } from '../core/database/data-source';
import { UserEntity } from '../core/user/entities/user.entity';
import { extractTokenFromHeader, verifyToken } from '../core/auth/services/jwt.service';

export function createEmailRoutes(): Router {
  const router = Router();
  const userRepository = AppDataSource.getRepository(UserEntity);

  /**
   * POST /api/email/verify
   * Verify email with token
   *
   * Request: { token: "verification-token" }
   * Response: { ok: true, data: { email, verifiedAt } }
   */
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'invalidRequest',
            message: 'Verification token is required',
          },
        });
      }

      // Verify the token
      const result = await emailVerificationService.verifyEmail(token);

      if (!result.ok) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'verificationFailed',
            message: result.error,
          },
        });
      }

      // Find the user with this email
      const user = await userRepository.findOne({
        where: { email: result.email },
      });

      if (!user) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'userNotFound',
            message: 'User not found',
          },
        });
      }

      // Mark user as verified
      await userRepository.update(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[EmailVerification] ✅ Email verified for user ${user.id}`);

      return res.json({
        ok: true,
        data: {
          email: user.email,
          verifiedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('[EmailVerification] ❌ Error verifying email:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'internalError',
          message: 'Failed to verify email',
        },
      });
    }
  });

  /**
   * POST /api/email/resend-verification
   * Request new verification email
   *
   * Request: { email }
   * Response: { ok: true, data: { email, expiresInHours } }
   */
  router.post('/resend-verification', async (req: Request, res: Response) => {
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

      // Find user
      const user = await userRepository.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // Don't reveal if email exists (security)
        return res.json({
          ok: true,
          data: {
            email,
            message: 'If this email is registered, a verification link will be sent shortly',
          },
        });
      }

      // Already verified
      if (user.emailVerified) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'alreadyVerified',
            message: 'This email is already verified',
          },
        });
      }

      // Check if can resend
      const canResend = await emailVerificationService.canResendVerification(user.id);
      if (!canResend.can) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'rateLimited',
            message: canResend.reason,
            nextResendAt: canResend.nextResendAt,
          },
        });
      }

      // Generate new token
      const tokenResult = await emailVerificationService.generateVerificationToken(user.id, user.email);

      // Send email
      const emailPayload = EmailTemplateBuilder.buildVerificationEmail(user.email, tokenResult.token);
      const sendResult = await emailSender.send(emailPayload);

      if (!sendResult.ok) {
        console.error('[EmailVerification] ❌ Failed to send verification email');
        return res.status(500).json({
          ok: false,
          error: {
            code: 'emailSendFailed',
            message: 'Failed to send verification email',
          },
        });
      }

      // Record resend attempt
      await emailVerificationService.recordResendAttempt(user.id);

      console.log(`[EmailVerification] ✅ Resend verification email to ${user.email}`);

      return res.json({
        ok: true,
        data: {
          email: user.email,
          expiresInHours: tokenResult.expiresInHours,
          message: 'Verification email sent. Check your inbox.',
        },
      });
    } catch (error) {
      console.error('[EmailVerification] ❌ Error resending verification:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'internalError',
          message: 'Failed to resend verification email',
        },
      });
    }
  });

  /**
   * GET /api/email/verification-status
   * Check verification status (requires auth)
   *
   * Headers: Authorization: Bearer {token}
   * Response: { ok: true, data: { verified, pendingEmail, expiresAt, attemptCount } }
   */
  router.get('/verification-status', async (req: Request, res: Response) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        return res.status(401).json({
          ok: false,
          error: {
            code: 'missingToken',
            message: 'Authorization header required',
          },
        });
      }

      // Verify JWT token
      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({
          ok: false,
          error: {
            code: 'invalidToken',
            message: 'Invalid or expired token',
          },
        });
      }

      // Get user
      const user = await userRepository.findOne({
        where: { id: payload.userId },
      });

      if (!user) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'userNotFound',
            message: 'User not found',
          },
        });
      }

      // Get verification status
      const status = await emailVerificationService.getVerificationStatus(user.id);

      return res.json({
        ok: true,
        data: {
          verified: user.emailVerified,
          verifiedAt: user.emailVerifiedAt,
          pendingEmail: status.pendingEmail,
          expiresAt: status.expiresAt,
          attemptCount: status.attemptCount,
          nextResendAt: status.nextResendAt,
        },
      });
    } catch (error) {
      console.error('[EmailVerification] ❌ Error getting verification status:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'internalError',
          message: 'Failed to get verification status',
        },
      });
    }
  });

  /**
   * POST /api/email/send-verification
   * Send initial verification email after signup
   * (Called internally after successful signup)
   *
   * Request: { userId }
   * Response: { ok: true, data: { email, expiresInHours } }
   */
  router.post('/send-verification', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'invalidRequest',
            message: 'User ID is required',
          },
        });
      }

      // Find user
      const user = await userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'userNotFound',
            message: 'User not found',
          },
        });
      }

      // Generate verification token
      const tokenResult = await emailVerificationService.generateVerificationToken(user.id, user.email);

      // Send email
      const emailPayload = EmailTemplateBuilder.buildVerificationEmail(user.email, tokenResult.token);
      const sendResult = await emailSender.send(emailPayload);

      if (!sendResult.ok) {
        console.error('[EmailVerification] ❌ Failed to send verification email');
        return res.status(500).json({
          ok: false,
          error: {
            code: 'emailSendFailed',
            message: 'Failed to send verification email',
          },
        });
      }

      console.log(`[EmailVerification] ✅ Sent verification email to ${user.email}`);

      return res.json({
        ok: true,
        data: {
          email: user.email,
          expiresInHours: tokenResult.expiresInHours,
        },
      });
    } catch (error) {
      console.error('[EmailVerification] ❌ Error sending verification email:', error);
      res.status(500).json({
        ok: false,
        error: {
          code: 'internalError',
          message: 'Failed to send verification email',
        },
      });
    }
  });

  return router;
}
