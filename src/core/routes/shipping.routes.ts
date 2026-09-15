/**
 * Shipping Routes
 * API endpoints for shipping methods, rates, and calculations
 *
 * Phase 8: Shipping Integration
 */

import { Router } from 'express';
// Phase 9: these were unauthenticated. POST /rates/import in particular let an
// anonymous caller overwrite the entire rate table in one request — zeroing
// every shipping charge in the shop. GET /methods/:methodId returned the full
// commercial rate card (weight bands, zones, per-unit rates), and the carrier
// endpoints let anyone enumerate the rate structure and, where they front a
// real carrier API, spend money doing it.
//
// Latent only because shipping_methods did not exist as a table; the guards go
// on before the tables, not after.
import { requireStaff } from '../middleware/require-staff.middleware';
import { ShippingController } from '../controllers/shipping.controller';
import {
  ShippingMethodService,
  ShippingRateService,
  ShippingCalculationService,
} from '../services/shipping.service';
import { CarrierIntegrationService } from '../services/carrier-integration.service';
import { ShippingMethodRepository, ShippingRateRepository } from '../repositories/shipping.repositories';

/**
 * Create shipping routes
 * Called from core routes registry
 */
export function createShippingRoutes(): Router {
  const router = Router({ mergeParams: true });

  // Initialize repositories
  const methodRepo = new ShippingMethodRepository();
  const rateRepo = new ShippingRateRepository();

  // Initialize services
  const methodService = new ShippingMethodService(methodRepo);
  const rateService = new ShippingRateService(rateRepo, methodRepo);
  const calculationService = new ShippingCalculationService(methodService, rateService);
  const carrierService = new CarrierIntegrationService();

  // Initialize controller
  const controller = new ShippingController(methodService, rateService, calculationService, carrierService);

  /**
   * Shipping Methods Routes
   * Base: /stores/:storeId/shipping/methods
   */

  // List active shipping methods
  router.get('/methods', (req, res) => controller.listMethods(req, res));

  // Get shipping method details
  router.get('/methods/:methodId', requireStaff, (req, res) => controller.getMethod(req, res));

  // Create new shipping method (admin)
  router.post('/methods', requireStaff, (req, res) => controller.createMethod(req, res));

  // Update shipping method (admin)
  router.put('/methods/:methodId', requireStaff, (req, res) => controller.updateMethod(req, res));

  /**
   * Shipping Rates Routes
   * Base: /stores/:storeId/shipping/rates
   */

  // Bulk import shipping rates (admin)
  router.post('/rates/import', requireStaff, (req, res) => controller.importRates(req, res));

  /**
   * Shipping Calculation Routes
   * Base: /stores/:storeId/shipping/calculate
   */

  // Calculate shipping cost
  router.post('/calculate', (req, res) => controller.calculateShipping(req, res));

  /**
   * Zone Management Routes
   * Base: /stores/:storeId/shipping/zones
   */

  // List all supported zones
  router.get('/zones', (req, res) => controller.listZones(req, res));

  // Validate zone
  router.post('/zones/validate', (req, res) => controller.validateZone(req, res));

  /**
   * Carrier Integration Routes
   * Base: /stores/:storeId/shipping/carriers
   */

  // Get real-time rates from specific carrier (admin)
  router.get('/carriers/:carrier/rates', requireStaff, (req, res) => controller.getCarrierRates(req, res));

  // Get rates from all carriers (admin)
  router.get('/carriers/rates/multi', requireStaff, (req, res) => controller.getMultiCarrierRates(req, res));

  return router;
}
