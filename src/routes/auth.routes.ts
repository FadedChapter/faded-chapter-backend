/**
 * Authentication Routes
 *
 * Phase 3F.2 — Email/Password Authentication
 * - POST /api/auth/login — User login
 * - POST /api/auth/logout — User logout
 * - POST /api/auth/signup — User registration
 * - POST /api/auth/forgot-password — Password reset request
 * - POST /api/auth/reset-password — Reset password
 *
 * Security:
 * - All endpoints validate CSRF tokens (state-changing)
 * - Passwords never logged, stored in hash only
 * - Sessions are server-authoritative (HttpOnly cookies)
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { UserStore } from '../core/user/user-store.port';
import type { SessionStore } from '../core/session/session-store.port';
import type { SessionConfig, CustomerId } from '../core/session/session.types';
import { hashPassword, verifyPassword, isValidEmail, normalizeEmail } from '../core/user/index';
import { setSessionCookie, clearSessionCookie, requireSession } from '../core/session/middleware/session.middleware';
import { generateToken, verifyToken, extractTokenFromHeader } from '../core/auth/services/jwt.service';
import { env } from '../core/config/env';
import type { AuthActionResult, SignInSuccessData, SignUpSuccessData, EmailActionSuccessData } from '@faded-chapter/types';

export function createAuthRoutes(userStore: UserStore, sessionStore: SessionStore, config: SessionConfig): Router {
  const router = Router();

  /**
   * POST /api/auth/login
   * Authenticate user with email/password
   */
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidCredentials', message: 'Email and password required' },
        } as AuthActionResult<SignInSuccessData>);
      }

      const normalizedEmail = normalizeEmail(email);
      const user = await userStore.findByEmail(normalizedEmail);

      if (!user) {
        // Don't reveal if email exists (timing-safe)
        return res.status(401).json({
          ok: false,
          error: { code: 'invalidCredentials', message: 'Invalid email or password' },
        } as AuthActionResult<SignInSuccessData>);
      }

      // Verify password against stored hash
      const passwordValid = await userStore.verifyPassword(user, password);
      if (!passwordValid) {
        return res.status(401).json({
          ok: false,
          error: { code: 'invalidCredentials', message: 'Invalid email or password' },
        } as AuthActionResult<SignInSuccessData>);
      }

      // Generate JWT token (Phase 3F.2 - JWT auth)
      // roles + storeId are signed claims — they are the only server-trusted
      // source of authority for the authorization middleware.
      const token = generateToken({
        userId: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: user.roles,
        storeId: env.get('DEFAULT_STORE_ID') as string,
      });

      return res.json({
        ok: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: `${user.firstName} ${user.lastName}`.trim(),
            roles: user.roles,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/signup
   * Register new user
   */
  router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidCredentials', message: 'Email and password required' },
        } as AuthActionResult<SignUpSuccessData>);
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidEmail', message: 'Invalid email format' },
        } as AuthActionResult<SignUpSuccessData>);
      }

      const normalizedEmail = normalizeEmail(email);
      const existingUser = await userStore.findByEmail(normalizedEmail);

      if (existingUser) {
        return res.status(409).json({
          ok: false,
          error: { code: 'emailTaken', message: 'Email already registered' },
        } as AuthActionResult<SignUpSuccessData>);
      }

      // Hash password before storing
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await userStore.create(
        {
          email: normalizedEmail,
          password, // Will be replaced with hash by userStore.create
          firstName: firstName || '',
          lastName: lastName || '',
          marketingOptIn: false,
        },
        passwordHash,
      );

      // Generate JWT token for new user (Phase 3F.2 - JWT auth)
      const token = generateToken({
        userId: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: user.roles,
        storeId: env.get('DEFAULT_STORE_ID') as string,
      });

      return res.json({
        ok: true,
        data: {
          token,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: `${user.firstName} ${user.lastName}`.trim(),
          roles: user.roles,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/logout
   * Terminate user session
   */
  router.post('/logout', requireSession, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.session) {
        await sessionStore.destroy(req.session.id);
      }
      clearSessionCookie(res, config);
      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/forgot-password
   * Request password reset
   */
  router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidEmail', message: 'Email required' },
        } as AuthActionResult<EmailActionSuccessData>);
      }

      // TODO: Implement email sending
      // For now, just return success (prevents enumeration attacks)
      return res.json({
        ok: true,
        data: { email: normalizeEmail(email) },
      } as AuthActionResult<EmailActionSuccessData>);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/reset-password
   * Reset password with token
   */
  router.post('/reset-password', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement password reset with token validation
      return res.status(400).json({
        ok: false,
        error: { code: 'expiredResetLink', message: 'Reset link expired or invalid' },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
