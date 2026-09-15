/**
 * Customer Routes
 * Customer profile and session management endpoints
 *
 * Phase 3: API Layer
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { SessionService } from '../services/session.service';

export function createCustomerRoutes(): Router {
  const router = Router();
  const customerController = new CustomerController();
  const sessionService = new SessionService();
  const auth = requireAuth(sessionService);

  const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

  /**
   * GET /customers/me
   * Get current customer profile
   * Requires: Authentication
   */
  router.get(
    '/me',
    auth,
    asyncHandler((req: Request, res: Response) => customerController.getProfile(req, res))
  );

  /**
   * PATCH /customers/me
   * Update current customer profile
   * Requires: Authentication
   */
  router.patch(
    '/me',
    auth,
    asyncHandler((req: Request, res: Response) => customerController.updateProfile(req, res))
  );

  /**
   * GET /customers/sessions
   * List active sessions
   * Requires: Authentication
   */
  router.get(
    '/sessions',
    auth,
    asyncHandler((req: Request, res: Response) => customerController.listSessions(req, res))
  );

  /**
   * DELETE /customers/sessions/:sessionId
   * Revoke a session
   * Requires: Authentication
   */
  router.delete(
    '/sessions/:sessionId',
    auth,
    asyncHandler((req: Request, res: Response) => customerController.revokeSession(req, res))
  );

  return router;
}
