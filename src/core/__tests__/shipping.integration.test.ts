/**
 * Shipping Integration Tests
 * Testing shipping methods, rates, calculations, and carrier integration
 *
 * Phase 8: Shipping Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShippingMethodEntity } from '../entities/shipping-method.entity';
import { ShippingRateEntity } from '../entities/shipping-rate.entity';
import { ShippingMethodRepository, ShippingRateRepository } from '../repositories/shipping.repositories';
import {
  ShippingMethodService,
  ShippingRateService,
  ShippingCalculationService,
} from '../services/shipping.service';
import { CarrierIntegrationService, FedExCarrierAdapter, UPSCarrierAdapter, USPSCarrierAdapter } from '../services/carrier-integration.service';
import {
  CreateShippingMethodDto,
  ImportShippingRatesDto,
  CalculateShippingDto,
} from '../dtos/shipping.dto';

describe('Shipping Integration Tests', () => {
  let methodRepo: ShippingMethodRepository;
  let rateRepo: ShippingRateRepository;
  let methodService: ShippingMethodService;
  let rateService: ShippingRateService;
  let calculationService: ShippingCalculationService;
  let carrierService: CarrierIntegrationService;

  const storeId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    methodRepo = new ShippingMethodRepository();
    rateRepo = new ShippingRateRepository();
    methodService = new ShippingMethodService(methodRepo);
    rateService = new ShippingRateService(rateRepo, methodRepo);
    calculationService = new ShippingCalculationService(methodService, rateService);
    carrierService = new CarrierIntegrationService();
  });

  describe('Shipping Method Management', () => {
    it('should create a new shipping method', async () => {
      const dto: CreateShippingMethodDto = {
        name: 'Standard Ground',
        description: '5-7 business days',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
        metadata: { carrier: 'fedex', service_code: 'FEDEX_GROUND' },
      };

      const method = await methodService.createMethod(storeId, dto);

      expect(method).toBeDefined();
      expect(method.id).toBeDefined();
      expect(method.store_id).toBe(storeId);
      expect(method.name).toBe('Standard Ground');
      expect(method.type).toBe('ground');
      expect(method.base_cost).toBe(5.99);
      expect(method.active).toBe(true);
    });

    it('should retrieve active shipping methods', async () => {
      const dto1: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };

      const dto2: CreateShippingMethodDto = {
        name: 'Express',
        type: 'express',
        base_cost: 15.99,
        est_days_min: 2,
        est_days_max: 3,
      };

      await methodService.createMethod(storeId, dto1);
      await methodService.createMethod(storeId, dto2);

      const methods = await methodService.listActiveMethods(storeId);

      expect(methods.length).toBe(2);
      expect(methods.some((m) => m.name === 'Standard')).toBe(true);
      expect(methods.some((m) => m.name === 'Express')).toBe(true);
    });

    it('should update shipping method', async () => {
      const dto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };

      const method = await methodService.createMethod(storeId, dto);

      const updated = await methodService.updateMethod(storeId, method.id, {
        base_cost: 7.99,
        est_days_max: 8,
      });

      expect(updated.base_cost).toBe(7.99);
      expect(updated.est_days_max).toBe(8);
    });

    it('should toggle method active status', async () => {
      const dto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };

      const method = await methodService.createMethod(storeId, dto);
      expect(method.active).toBe(true);

      const deactivated = await methodService.toggleMethodActive(storeId, method.id, false);
      expect(deactivated.active).toBe(false);

      const reactivated = await methodService.toggleMethodActive(storeId, method.id, true);
      expect(reactivated.active).toBe(true);
    });
  });

  describe('Shipping Rate Management', () => {
    it('should import weight-based shipping rates', async () => {
      // Create a method first
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };
      const method = await methodService.createMethod(storeId, methodDto);

      // Import rates
      const importDto: ImportShippingRatesDto = {
        method_id: method.id,
        rates: [
          { method_id: method.id, weight_min: 0, weight_max: 1, zone_code: 'USA', base_rate: 5.99, rate_per_unit: 0.5 },
          { method_id: method.id, weight_min: 1, weight_max: 5, zone_code: 'USA', base_rate: 8.99, rate_per_unit: 1.0 },
          { method_id: method.id, weight_min: 5, weight_max: 50, zone_code: 'USA', base_rate: 15.99, rate_per_unit: 2.0 },
        ],
      };

      const rates = await rateService.importRates(storeId, importDto);

      expect(rates.length).toBe(3);
      expect(rates[0].weight_min).toBe(0);
      expect(rates[0].weight_max).toBe(1);
      expect(rates[2].base_rate).toBe(15.99);
    });

    it('should find rate for specific weight', async () => {
      // Create method
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };
      const method = await methodService.createMethod(storeId, methodDto);

      // Import rates
      const importDto: ImportShippingRatesDto = {
        method_id: method.id,
        rates: [
          { method_id: method.id, weight_min: 0, weight_max: 5, zone_code: 'USA', base_rate: 8.99, rate_per_unit: 1.0 },
          { method_id: method.id, weight_min: 5, weight_max: 50, zone_code: 'USA', base_rate: 15.99, rate_per_unit: 2.0 },
        ],
      };

      await rateService.importRates(storeId, importDto);

      // Find rates
      const rate1 = await rateService.findRateForWeight(storeId, method.id, 2, 'USA');
      expect(rate1).toBeDefined();
      expect(rate1?.base_rate).toBe(8.99);

      const rate2 = await rateService.findRateForWeight(storeId, method.id, 10, 'USA');
      expect(rate2).toBeDefined();
      expect(rate2?.base_rate).toBe(15.99);
    });

    it('should list supported zones', async () => {
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };
      const method = await methodService.createMethod(storeId, methodDto);

      const importDto: ImportShippingRatesDto = {
        method_id: method.id,
        rates: [
          { method_id: method.id, weight_min: 0, weight_max: 50, zone_code: 'USA', base_rate: 8.99 },
          { method_id: method.id, weight_min: 0, weight_max: 50, zone_code: 'CANADA', base_rate: 15.99 },
          { method_id: method.id, weight_min: 0, weight_max: 50, zone_code: 'INTL', base_rate: 29.99 },
        ],
      };

      await rateService.importRates(storeId, importDto);

      const zones = await rateService.getZones(storeId);
      expect(zones.length).toBeGreaterThanOrEqual(3);
      expect(zones).toContain('USA');
      expect(zones).toContain('CANADA');
      expect(zones).toContain('INTL');
    });

    it('should validate zone support', async () => {
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };
      const method = await methodService.createMethod(storeId, methodDto);

      const importDto: ImportShippingRatesDto = {
        method_id: method.id,
        rates: [{ method_id: method.id, weight_min: 0, weight_max: 50, zone_code: 'USA', base_rate: 8.99 }],
      };

      await rateService.importRates(storeId, importDto);

      const validZone = await rateService.validateZone(storeId, 'USA');
      expect(validZone).toBe(true);

      const invalidZone = await rateService.validateZone(storeId, 'NONEXISTENT');
      expect(invalidZone).toBe(false);
    });
  });

  describe('Shipping Cost Calculation', () => {
    it('should calculate shipping cost for cart', async () => {
      // Create method
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };
      const method = await methodService.createMethod(storeId, methodDto);

      // Import rates
      const importDto: ImportShippingRatesDto = {
        method_id: method.id,
        rates: [
          { method_id: method.id, weight_min: 0, weight_max: 50, zone_code: 'USA', base_rate: 5.99, rate_per_unit: 0.5 },
        ],
      };

      await rateService.importRates(storeId, importDto);

      // Calculate shipping
      const calcDto: CalculateShippingDto = {
        method_id: method.id,
        weight: 10,
        destination: 'USA',
      };

      const calculation = await calculationService.calculateRate(storeId, calcDto);

      expect(calculation).toBeDefined();
      expect(calculation.method.id).toBe(method.id);
      expect(calculation.base_rate).toBe(5.99);
      expect(calculation.weight_rate).toBe(5.0); // (10 - 0) * 0.5
      expect(calculation.shipping_cost).toBe(10.99); // 5.99 + 5.0
    });

    it('should reject calculation for unsupported zone', async () => {
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };
      const method = await methodService.createMethod(storeId, methodDto);

      const importDto: ImportShippingRatesDto = {
        method_id: method.id,
        rates: [{ method_id: method.id, weight_min: 0, weight_max: 50, zone_code: 'USA', base_rate: 5.99 }],
      };

      await rateService.importRates(storeId, importDto);

      const calcDto: CalculateShippingDto = {
        method_id: method.id,
        weight: 5,
        destination: 'NONEXISTENT',
      };

      await expect(calculationService.calculateRate(storeId, calcDto)).rejects.toThrow();
    });

    it('should get available methods for weight and zone', async () => {
      // Create methods
      const groundDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };
      const ground = await methodService.createMethod(storeId, groundDto);

      const expressDto: CreateShippingMethodDto = {
        name: 'Express',
        type: 'express',
        base_cost: 15.99,
        est_days_min: 2,
        est_days_max: 3,
      };
      const express = await methodService.createMethod(storeId, expressDto);

      // Import rates
      const importDto: ImportShippingRatesDto = {
        method_id: ground.id,
        rates: [
          { method_id: ground.id, weight_min: 0, weight_max: 50, zone_code: 'USA', base_rate: 5.99, rate_per_unit: 0.5 },
          { method_id: express.id, weight_min: 0, weight_max: 50, zone_code: 'USA', base_rate: 15.99, rate_per_unit: 1.0 },
        ],
      };

      // Need to import for both methods
      const groundImport = { ...importDto, method_id: ground.id, rates: importDto.rates.filter((r) => r.method_id === ground.id) };
      const expressImport = { ...importDto, method_id: express.id, rates: importDto.rates.filter((r) => r.method_id === express.id) };

      await rateService.importRates(storeId, groundImport);
      await rateService.importRates(storeId, expressImport);

      // Get available methods
      const available = await calculationService.getAvailableMethodsForWeight(storeId, 5, 'USA');

      expect(available.length).toBeGreaterThan(0);
      expect(available.some((m) => m.method.id === ground.id)).toBe(true);
    });
  });

  describe('Store Isolation', () => {
    it('should prevent cross-store method access', async () => {
      const storeId2 = '550e8400-e29b-41d4-a716-446655440002';

      const dto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };

      const method = await methodService.createMethod(storeId, dto);

      // Try to access from different store
      await expect(methodService.getMethod(storeId2, method.id)).rejects.toThrow();
    });

    it('should prevent cross-store rate access', async () => {
      const storeId2 = '550e8400-e29b-41d4-a716-446655440002';

      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };

      const method = await methodService.createMethod(storeId, methodDto);

      // Try to access from different store
      await expect(rateService.getRatesForMethod(storeId2, method.id)).rejects.toThrow();
    });
  });

  describe('Carrier Integration', () => {
    it('should get FedEx rates', async () => {
      const shipment = {
        carrier: 'fedex' as const,
        weight: 5,
        zone: 'USA',
        destination: 'USA',
      };

      const rates = await carrierService.getRates('fedex', shipment);

      expect(rates.carrier).toBe('fedex');
      expect(rates.rates.length).toBeGreaterThan(0);
    });

    it('should get UPS rates', async () => {
      const shipment = {
        carrier: 'ups' as const,
        weight: 5,
        zone: 'USA',
        destination: 'USA',
      };

      const rates = await carrierService.getRates('ups', shipment);

      expect(rates.carrier).toBe('ups');
      expect(rates.rates.length).toBeGreaterThan(0);
    });

    it('should get USPS rates', async () => {
      const shipment = {
        carrier: 'usps' as const,
        weight: 2,
        zone: 'USA',
        destination: 'USA',
      };

      const rates = await carrierService.getRates('usps', shipment);

      expect(rates.carrier).toBe('usps');
    });

    it('should reject unsupported carrier', async () => {
      const shipment = {
        carrier: 'fedex' as const,
        weight: 5,
        zone: 'USA',
        destination: 'USA',
      };

      const rates = await carrierService.getRates('unsupported_carrier', shipment);

      expect(rates.error).toBeDefined();
      expect(rates.rates.length).toBe(0);
    });

    it('should get multi-carrier rates', async () => {
      const shipment = {
        carrier: 'fedex' as const,
        weight: 5,
        zone: 'USA',
        destination: 'USA',
      };

      const allRates = await carrierService.getMultiCarrierRates(shipment);

      expect(allRates.length).toBeGreaterThan(0);
      expect(allRates.some((r) => r.carrier === 'fedex')).toBe(true);
    });

    it('should list available carriers', () => {
      const carriers = carrierService.getAvailableCarriers();

      expect(carriers.length).toBeGreaterThan(0);
      expect(carriers).toContain('fedex');
      expect(carriers).toContain('ups');
      expect(carriers).toContain('usps');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing shipping method gracefully', async () => {
      const calcDto: CalculateShippingDto = {
        method_id: 'nonexistent-id',
        weight: 5,
        destination: 'USA',
      };

      await expect(calculationService.calculateRate(storeId, calcDto)).rejects.toThrow();
    });

    it('should handle inactive method gracefully', async () => {
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };

      const method = await methodService.createMethod(storeId, methodDto);
      await methodService.toggleMethodActive(storeId, method.id, false);

      const calcDto: CalculateShippingDto = {
        method_id: method.id,
        weight: 5,
        destination: 'USA',
      };

      await expect(calculationService.calculateRate(storeId, calcDto)).rejects.toThrow();
    });

    it('should handle weight out of range', async () => {
      const methodDto: CreateShippingMethodDto = {
        name: 'Standard',
        type: 'ground',
        base_cost: 5.99,
        est_days_min: 5,
        est_days_max: 7,
      };

      const method = await methodService.createMethod(storeId, methodDto);

      const importDto: ImportShippingRatesDto = {
        method_id: method.id,
        rates: [{ method_id: method.id, weight_min: 0, weight_max: 5, zone_code: 'USA', base_rate: 8.99 }],
      };

      await rateService.importRates(storeId, importDto);

      const calcDto: CalculateShippingDto = {
        method_id: method.id,
        weight: 100, // Out of range
        destination: 'USA',
      };

      await expect(calculationService.calculateRate(storeId, calcDto)).rejects.toThrow();
    });
  });
});
