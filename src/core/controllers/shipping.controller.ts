/**
 * Shipping Controller
 * HTTP request handlers for shipping domain
 *
 * Phase 8: Shipping Integration
 */

import { Request, Response } from 'express';
import {
  ShippingMethodService,
  ShippingRateService,
  ShippingCalculationService,
} from '../services/shipping.service';
import { CarrierIntegrationService } from '../services/carrier-integration.service';
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
  ImportShippingRatesDto,
  CalculateShippingDto,
} from '../dtos/shipping.dto';

/**
 * Shipping Controller
 * Handles shipping methods, rates, calculations, and carrier integration
 */
export class ShippingController {
  constructor(
    private methodService: ShippingMethodService,
    private rateService: ShippingRateService,
    private calculationService: ShippingCalculationService,
    private carrierService: CarrierIntegrationService
  ) {}

  /**
   * GET /shipping/methods
   * List all active shipping methods for a store
   */
  async listMethods(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const methods = await this.methodService.listActiveMethods(storeId);
      res.status(200).json({
        ok: true,
        data: methods,
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'list_methods_error', message: (error as Error).message },
      });
    }
  }

  /**
   * GET /shipping/methods/:methodId
   * Get details of a specific shipping method
   */
  async getMethod(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, methodId } = req.params;
      const method = await this.methodService.getMethod(storeId, methodId);

      // Get rates for this method
      const rates = await this.rateService.getRatesForMethod(storeId, methodId);

      res.status(200).json({
        ok: true,
        data: {
          ...method,
          rates,
        },
      });
    } catch (error) {
      res.status(404).json({
        ok: false,
        error: { code: 'method_not_found', message: 'Shipping method not found' },
      });
    }
  }

  /**
   * POST /shipping/methods
   * Create a new shipping method (admin)
   */
  async createMethod(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const dto = req.body as CreateShippingMethodDto;

      const method = await this.methodService.createMethod(storeId, dto);

      res.status(201).json({
        ok: true,
        data: method,
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'create_method_error', message: (error as Error).message },
      });
    }
  }

  /**
   * PUT /shipping/methods/:methodId
   * Update a shipping method (admin)
   */
  async updateMethod(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, methodId } = req.params;
      const dto = req.body as UpdateShippingMethodDto;

      const method = await this.methodService.updateMethod(storeId, methodId, dto);

      res.status(200).json({
        ok: true,
        data: method,
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'update_method_error', message: (error as Error).message },
      });
    }
  }

  /**
   * POST /shipping/rates/import
   * Bulk import shipping rates for a method (admin)
   */
  async importRates(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const dto = req.body as ImportShippingRatesDto;

      const rates = await this.rateService.importRates(storeId, dto);

      res.status(201).json({
        ok: true,
        data: {
          imported: rates.length,
          rates,
        },
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'import_rates_error', message: (error as Error).message },
      });
    }
  }

  /**
   * POST /shipping/calculate
   * Calculate shipping cost for a cart/package
   */
  async calculateShipping(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const dto = req.body as CalculateShippingDto;

      const calculation = await this.calculationService.calculateRate(storeId, dto);

      res.status(200).json({
        ok: true,
        data: calculation,
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'calculate_error', message: (error as Error).message },
      });
    }
  }

  /**
   * GET /shipping/zones
   * List all supported shipping zones
   */
  async listZones(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const zones = await this.rateService.getZones(storeId);

      res.status(200).json({
        ok: true,
        data: {
          zones,
          count: zones.length,
        },
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'list_zones_error', message: (error as Error).message },
      });
    }
  }

  /**
   * POST /shipping/zones/validate
   * Validate if a zone is supported
   */
  async validateZone(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const { destination } = req.body;

      if (!destination) {
        res.status(400).json({
          ok: false,
          error: { code: 'missing_destination', message: 'Destination is required' },
        });
        return;
      }

      const valid = await this.rateService.validateZone(storeId, destination);

      res.status(200).json({
        ok: true,
        data: {
          valid,
          zone: destination,
          message: valid ? 'Zone is supported' : 'Zone is not supported',
        },
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'validate_zone_error', message: (error as Error).message },
      });
    }
  }

  /**
   * GET /shipping/carriers/:carrier/rates
   * Get real-time rates from a specific carrier (admin)
   */
  async getCarrierRates(req: Request, res: Response): Promise<void> {
    try {
      const { carrier } = req.params;
      const { weight, destination } = req.query;

      if (!weight || !destination) {
        res.status(400).json({
          ok: false,
          error: {
            code: 'missing_params',
            message: 'Weight and destination are required',
          },
        });
        return;
      }

      const shipment = {
        carrier: carrier as 'fedex' | 'ups' | 'usps',
        weight: parseFloat(weight as string),
        zone: destination as string,
        destination: destination as string,
      };

      const rates = await this.carrierService.getRates(carrier, shipment);

      if (rates.error) {
        res.status(400).json({
          ok: false,
          error: { code: 'carrier_error', message: rates.error },
        });
        return;
      }

      res.status(200).json({
        ok: true,
        data: rates,
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'carrier_rates_error', message: (error as Error).message },
      });
    }
  }

  /**
   * GET /shipping/carriers/rates/multi
   * Get real-time rates from all available carriers (admin)
   */
  async getMultiCarrierRates(req: Request, res: Response): Promise<void> {
    try {
      const { weight, destination } = req.query;

      if (!weight || !destination) {
        res.status(400).json({
          ok: false,
          error: {
            code: 'missing_params',
            message: 'Weight and destination are required',
          },
        });
        return;
      }

      const shipment = {
        carrier: 'fedex' as const,
        weight: parseFloat(weight as string),
        zone: destination as string,
        destination: destination as string,
      };

      const allRates = await this.carrierService.getMultiCarrierRates(shipment);

      res.status(200).json({
        ok: true,
        data: {
          rates: allRates,
          count: allRates.length,
        },
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: { code: 'multi_carrier_error', message: (error as Error).message },
      });
    }
  }
}
