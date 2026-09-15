/**
 * Address Routes
 * Customer address management endpoints
 *
 * Phase 3: API Layer
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AddressController } from '../controllers/address.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { SessionService } from '../services/session.service';

export function createAddressRoutes(): Router {
  const router = Router();
  const addressController = new AddressController();
  const sessionService = new SessionService();
  const auth = requireAuth(sessionService);

  const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

  /**
   * GET /addresses
   * List all addresses
   * Requires: Authentication
   */
  router.get(
    '/',
    auth,
    asyncHandler((req: Request, res: Response) => addressController.listAddresses(req, res))
  );

  /**
   * POST /addresses
   * Create new address
   * Requires: Authentication
   */
  router.post(
    '/',
    auth,
    asyncHandler((req: Request, res: Response) => addressController.createAddress(req, res))
  );

  /**
   * PATCH /addresses/:addressId
   * Update address
   * Requires: Authentication
   */
  router.patch(
    '/:addressId',
    auth,
    asyncHandler((req: Request, res: Response) => addressController.updateAddress(req, res))
  );

  /**
   * DELETE /addresses/:addressId
   * Delete address (soft delete)
   * Requires: Authentication
   */
  router.delete(
    '/:addressId',
    auth,
    asyncHandler((req: Request, res: Response) => addressController.deleteAddress(req, res))
  );

  /**
   * POST /addresses/:addressId/set-default-shipping
   * Set as default shipping address
   * Requires: Authentication
   */
  router.post(
    '/:addressId/set-default-shipping',
    auth,
    asyncHandler((req: Request, res: Response) => addressController.setDefaultShipping(req, res))
  );

  /**
   * POST /addresses/:addressId/set-default-billing
   * Set as default billing address
   * Requires: Authentication
   */
  router.post(
    '/:addressId/set-default-billing',
    auth,
    asyncHandler((req: Request, res: Response) => addressController.setDefaultBilling(req, res))
  );

  return router;
}
