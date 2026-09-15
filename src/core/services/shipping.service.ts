/**
 * Shipping Services
 * Shipping method management and rate calculation
 *
 * Phase 8: Shipping Integration
 */

import { ShippingMethodEntity } from '../entities/shipping-method.entity';
import { ShippingRateEntity } from '../entities/shipping-rate.entity';
import { ShippingMethodRepository, ShippingRateRepository } from '../repositories/shipping.repositories';
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
  ImportShippingRatesDto,
  CalculateShippingDto,
  ShippingCalculationResponseDto,
} from '../dtos/shipping.dto';

/**
 * Shipping Method Service
 * Manages available shipping methods and their configuration
 */
export class ShippingMethodService {
  constructor(private methodRepo: ShippingMethodRepository) {}

  async createMethod(storeId: string, dto: CreateShippingMethodDto): Promise<ShippingMethodEntity> {
    const method = new ShippingMethodEntity();
    method.id = crypto.randomUUID();
    method.store_id = storeId;
    method.name = dto.name;
    method.description = dto.description;
    method.type = dto.type;
    method.base_cost = dto.base_cost;
    method.est_days_min = dto.est_days_min;
    method.est_days_max = dto.est_days_max;
    method.active = true;
    method.metadata = dto.metadata || {};
    method.created_at = new Date();
    method.updated_at = new Date();

    return this.methodRepo.save(method);
  }

  async getMethod(storeId: string, methodId: string): Promise<ShippingMethodEntity> {
    return this.methodRepo.findByIdOrFail(methodId, storeId);
  }

  async listActiveMethods(storeId: string): Promise<ShippingMethodEntity[]> {
    return this.methodRepo.findActiveByStore(storeId);
  }

  async listAllMethods(storeId: string): Promise<ShippingMethodEntity[]> {
    return this.methodRepo.findAllByStore(storeId);
  }

  async updateMethod(
    storeId: string,
    methodId: string,
    dto: UpdateShippingMethodDto
  ): Promise<ShippingMethodEntity> {
    const method = await this.methodRepo.findByIdOrFail(methodId, storeId);

    if (dto.name !== undefined) method.name = dto.name;
    if (dto.description !== undefined) method.description = dto.description;
    if (dto.type !== undefined) method.type = dto.type;
    if (dto.base_cost !== undefined) method.base_cost = dto.base_cost;
    if (dto.est_days_min !== undefined) method.est_days_min = dto.est_days_min;
    if (dto.est_days_max !== undefined) method.est_days_max = dto.est_days_max;
    if (dto.active !== undefined) method.active = dto.active;
    if (dto.metadata) method.metadata = { ...method.metadata, ...dto.metadata };

    method.updated_at = new Date();

    return this.methodRepo.save(method);
  }

  async toggleMethodActive(storeId: string, methodId: string, active: boolean): Promise<ShippingMethodEntity> {
    return this.methodRepo.toggleActive(methodId, storeId, active);
  }

  async getMethodByCarrier(storeId: string, carrierCode: string): Promise<ShippingMethodEntity[]> {
    return this.methodRepo.findByCarrier(storeId, carrierCode);
  }
}

/**
 * Shipping Rate Service
 * Manages shipping rates and weight-based pricing tiers
 */
export class ShippingRateService {
  constructor(
    private rateRepo: ShippingRateRepository,
    private methodRepo: ShippingMethodRepository
  ) {}

  async getRatesForMethod(storeId: string, methodId: string): Promise<ShippingRateEntity[]> {
    // Verify method exists in store
    await this.methodRepo.findByIdOrFail(methodId, storeId);
    return this.rateRepo.findRatesForMethod(methodId, storeId);
  }

  async importRates(storeId: string, dto: ImportShippingRatesDto): Promise<ShippingRateEntity[]> {
    // Verify method exists in store
    await this.methodRepo.findByIdOrFail(dto.method_id, storeId);

    const rateEntities = dto.rates.map((rate) => ({
      ...rate,
      id: crypto.randomUUID(),
      store_id: storeId,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    return this.rateRepo.createBatch(storeId, rateEntities);
  }

  async getZones(storeId: string): Promise<string[]> {
    return this.rateRepo.getZones(storeId);
  }

  async validateZone(storeId: string, zone: string): Promise<boolean> {
    const zones = await this.getZones(storeId);
    return zones.includes(zone);
  }

  async findRateForWeight(
    storeId: string,
    methodId: string,
    weight: number,
    zone: string
  ): Promise<ShippingRateEntity | null> {
    return this.rateRepo.findRateForWeightQueryBuilder(methodId, weight, zone, storeId);
  }
}

/**
 * Shipping Calculation Service
 * Calculates shipping costs based on method, weight, and destination
 */
export class ShippingCalculationService {
  private rateCache: Map<string, { rate: ShippingRateEntity; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private methodService: ShippingMethodService,
    private rateService: ShippingRateService
  ) {}

  async calculateRate(storeId: string, dto: CalculateShippingDto): Promise<ShippingCalculationResponseDto> {
    // Validate method
    const method = await this.methodService.getMethod(storeId, dto.method_id);

    if (!method.active) {
      throw new Error('Shipping method is not available');
    }

    // Validate zone
    const zoneValid = await this.rateService.validateZone(storeId, dto.destination);
    if (!zoneValid) {
      throw new Error(`Shipping zone "${dto.destination}" is not supported`);
    }

    // Find applicable rate for weight
    const rate = await this.rateService.findRateForWeight(storeId, dto.method_id, dto.weight, dto.destination);

    if (!rate) {
      throw new Error(`No shipping rate found for weight ${dto.weight} lbs in zone ${dto.destination}`);
    }

    // Calculate shipping cost
    const weightRate = Math.max(0, (dto.weight - rate.weight_min) * rate.rate_per_unit);
    const shippingCost = rate.base_rate + weightRate;

    return {
      method: {
        id: method.id,
        store_id: method.store_id,
        name: method.name,
        description: method.description,
        type: method.type,
        base_cost: method.base_cost,
        est_days_min: method.est_days_min,
        est_days_max: method.est_days_max,
        active: method.active,
        metadata: method.metadata,
        created_at: method.created_at,
        updated_at: method.updated_at,
      },
      base_rate: rate.base_rate,
      weight_rate: weightRate,
      shipping_cost: parseFloat(shippingCost.toFixed(2)),
      estimated_days_min: method.est_days_min,
      estimated_days_max: method.est_days_max,
      zone: dto.destination,
    };
  }

  async getAvailableMethodsForWeight(
    storeId: string,
    weight: number,
    zone: string
  ): Promise<{ method: ShippingMethodEntity; cost: number }[]> {
    const activeMethods = await this.methodService.listActiveMethods(storeId);
    const results: { method: ShippingMethodEntity; cost: number }[] = [];

    for (const method of activeMethods) {
      const rate = await this.rateService.findRateForWeight(storeId, method.id, weight, zone);
      if (rate) {
        const weightRate = Math.max(0, (weight - rate.weight_min) * rate.rate_per_unit);
        const cost = rate.base_rate + weightRate;
        results.push({
          method,
          cost: parseFloat(cost.toFixed(2)),
        });
      }
    }

    // Sort by cost
    results.sort((a, b) => a.cost - b.cost);

    return results;
  }

  async getShippingEstimate(storeId: string, weight: number, zone: string): Promise<number> {
    const methods = await this.getAvailableMethodsForWeight(storeId, weight, zone);
    if (methods.length === 0) {
      throw new Error('No shipping methods available for this weight/zone combination');
    }
    // Return cheapest option
    return methods[0].cost;
  }

  private getCacheKey(methodId: string, weight: number, zone: string): string {
    return `${methodId}:${weight}:${zone}`;
  }

  private clearOldCacheEntries(): void {
    const now = Date.now();
    for (const [key, value] of this.rateCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.rateCache.delete(key);
      }
    }
  }
}
