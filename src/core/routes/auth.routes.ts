/**
 * Auth Routes
 * Authentication endpoints
 *
 * Phase 3: API Layer
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { SessionService } from '../services/session.service';

export function createAuthRoutes(): Router {
  const router = Router();
  const authController = new AuthController();
  const sessionService = new SessionService();
  const auth = requireAuth(sessionService);

  // Wrap controller methods to handle async errors
  const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

  /**
   * POST /auth/register
   * Register new customer
   */
  router.post('/register', asyncHandler((req: Request, res: Response) => authController.register(req, res)));

  /**
   * POST /auth/login
   * Login with email and password
   */
  router.post('/login', asyncHandler((req: Request, res: Response) => authController.login(req, res)));

  /**
   * POST /auth/logout
   * Logout current session
   * Requires: Authentication
   */
  router.post(
    '/logout',
    auth,
    asyncHandler((req: Request, res: Response) => authController.logout(req, res))
  );

  /**
   * POST /auth/logout-everywhere
   * Logout all sessions
   * Requires: Authentication
   */
  router.post(
    '/logout-everywhere',
    auth,
    asyncHandler((req: Request, res: Response) => authController.logoutEverywhere(req, res))
  );

  /**
   * POST /email-verification/send
   * Send email verification token
   * Requires: Authentication
   */
  router.post(
    '/email-verification/send',
    auth,
    asyncHandler((req: Request, res: Response) => authController.sendEmailVerification(req, res))
  );

  /**
   * POST /email-verification/verify
   * Verify email with token
   */
  router.post(
    '/email-verification/verify',
    asyncHandler((req: Request, res: Response) => authController.verifyEmail(req, res))
  );

  /**
   * POST /password/forgot
   * Request password reset
   */
  router.post(
    '/password/forgot',
    asyncHandler((req: Request, res: Response) => authController.forgotPassword(req, res))
  );

  /**
   * POST /password/reset
   * Reset password with token
   */
  router.post(
    '/password/reset',
    asyncHandler((req: Request, res: Response) => authController.resetPassword(req, res))
  );

  /**
   * POST /password/change
   * Change password while logged in
   * Requires: Authentication
   */
  router.post(
    '/password/change',
    auth,
    asyncHandler((req: Request, res: Response) => authController.changePassword(req, res))
  );

  return router;
}
