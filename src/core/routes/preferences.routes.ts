/**
 * Preferences Routes
 * Customer preferences management endpoints
 *
 * Phase 3: API Layer
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PreferencesController } from '../controllers/preferences.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { SessionService } from '../services/session.service';

export function createPreferencesRoutes(): Router {
  const router = Router();
  const preferencesController = new PreferencesController();
  const sessionService = new SessionService();
  const auth = requireAuth(sessionService);

  const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

  /**
   * GET /preferences
   * Get customer preferences
   * Requires: Authentication
   */
  router.get(
    '/',
    auth,
    asyncHandler((req: Request, res: Response) => preferencesController.getPreferences(req, res))
  );

  /**
   * PATCH /preferences/email
   * Update email preferences
   * Requires: Authentication
   */
  router.patch(
    '/email',
    auth,
    asyncHandler((req: Request, res: Response) => preferencesController.updateEmailPreferences(req, res))
  );

  /**
   * PATCH /preferences/sms
   * Update SMS preferences
   * Requires: Authentication
   */
  router.patch(
    '/sms',
    auth,
    asyncHandler((req: Request, res: Response) => preferencesController.updateSmsPreferences(req, res))
  );

  /**
   * PATCH /preferences/localization
   * Update language and timezone
   * Requires: Authentication
   */
  router.patch(
    '/localization',
    auth,
    asyncHandler((req: Request, res: Response) => preferencesController.updateLocalization(req, res))
  );

  /**
   * PATCH /preferences/shopping
   * Update shopping preferences
   * Requires: Authentication
   */
  router.patch(
    '/shopping',
    auth,
    asyncHandler((req: Request, res: Response) => preferencesController.updateShoppingPreferences(req, res))
  );

  /**
   * PATCH /preferences/custom
   * Update custom settings
   * Requires: Authentication
   */
  router.patch(
    '/custom',
    auth,
    asyncHandler((req: Request, res: Response) => preferencesController.updateCustomSettings(req, res))
  );

  return router;
}
