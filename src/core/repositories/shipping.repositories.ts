/**
 * Shipping Repositories
 * Shipping methods and rates repositories for multi-tenant shipping integration
 *
 * Phase 8: Shipping Integration
 */

import { BaseRepository } from '../repository/base-repository';
import { ShippingMethodEntity } from '../entities/shipping-method.entity';
import { ShippingRateEntity } from '../entities/shipping-rate.entity';

/**
 * Shipping Method Repository
 * Manages available shipping methods per store
 */
export class ShippingMethodRepository extends BaseRepository<ShippingMethodEntity> {
  constructor() {
    super(ShippingMethodEntity);
  }

  async findActiveByStore(storeId: string): Promise<ShippingMethodEntity[]> {
    return this.repository.find({
      where: { store_id: storeId, active: true } as any,
      order: { created_at: 'ASC' } as any,
    });
  }

  async findById(id: string, storeId: string): Promise<ShippingMethodEntity | null> {
    return this.repository.findOne({
      where: { id, store_id: storeId } as any,
    });
  }

  async findByIdOrFail(id: string, storeId: string): Promise<ShippingMethodEntity> {
    const method = await this.findById(id, storeId);
    if (!method) {
      throw new Error(`Shipping method ${id} not found for store ${storeId}`);
    }
    return method;
  }

  async findByCarrier(storeId: string, carrierCode: string): Promise<ShippingMethodEntity[]> {
    return this.repository
      .createQueryBuilder('sm')
      .where('sm.store_id = :storeId', { storeId })
      .andWhere(`sm.metadata->>'carrier' = :carrierCode`, { carrierCode })
      .orderBy('sm.created_at', 'ASC')
      .getMany();
  }

  async update(id: string, storeId: string, data: Partial<ShippingMethodEntity>): Promise<ShippingMethodEntity> {
    const method = await this.findByIdOrFail(id, storeId);
    Object.assign(method, data);
    method.updated_at = new Date();
    return this.save(method);
  }

  async toggleActive(id: string, storeId: string, active: boolean): Promise<ShippingMethodEntity> {
    return this.update(id, storeId, { active });
  }

  async findAllByStore(storeId: string): Promise<ShippingMethodEntity[]> {
    return this.repository.find({
      where: { store_id: storeId } as any,
      order: { created_at: 'ASC' } as any,
    });
  }
}

/**
 * Shipping Rate Repository
 * Manages weight-based shipping rates per method and zone
 */
export class ShippingRateRepository extends BaseRepository<ShippingRateEntity> {
  constructor() {
    super(ShippingRateEntity);
  }

  async findRatesForMethod(methodId: string, storeId: string): Promise<ShippingRateEntity[]> {
    return this.repository.find({
      where: { method_id: methodId, store_id: storeId, active: true } as any,
      order: { weight_min: 'ASC', zone_code: 'ASC' } as any,
    });
  }

  async findRateForWeight(
    methodId: string,
    weight: number,
    zone: string,
    storeId: string
  ): Promise<ShippingRateEntity | null> {
    return this.repository.findOne({
      where: {
        method_id: methodId,
        store_id: storeId,
        zone_code: zone,
        weight_min: { $lte: weight } as any,
        weight_max: { $gt: weight } as any,
        active: true,
      } as any,
    });
  }

  async findRateForWeightQueryBuilder(
    methodId: string,
    weight: number,
    zone: string,
    storeId: string
  ): Promise<ShippingRateEntity | null> {
    return this.repository
      .createQueryBuilder('sr')
      .where('sr.method_id = :methodId', { methodId })
      .andWhere('sr.store_id = :storeId', { storeId })
      .andWhere('sr.zone_code = :zone', { zone })
      .andWhere('sr.weight_min <= :weight', { weight })
      .andWhere('sr.weight_max > :weight', { weight })
      .andWhere('sr.active = :active', { active: true })
      .orderBy('sr.weight_min', 'DESC') // Get most specific tier
      .getOne() || null;
  }

  async getZones(storeId: string): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('sr')
      .where('sr.store_id = :storeId', { storeId })
      .select('DISTINCT sr.zone_code', 'zone_code')
      .orderBy('sr.zone_code', 'ASC')
      .getRawMany();

    return result.map((r: any) => r.zone_code);
  }

  async createBatch(storeId: string, rates: Omit<ShippingRateEntity, 'id' | 'created_at' | 'updated_at'>[]): Promise<ShippingRateEntity[]> {
    const entities = rates.map((rate) => {
      const entity = new ShippingRateEntity();
      Object.assign(entity, rate, { id: this.generateId(), store_id: storeId });
      return entity;
    });

    return this.repository.save(entities);
  }

  async updateRate(
    id: string,
    storeId: string,
    data: Partial<ShippingRateEntity>
  ): Promise<ShippingRateEntity> {
    const rate = await this.findByIdOrFail(id, storeId);
    Object.assign(rate, data);
    rate.updated_at = new Date();
    return this.save(rate);
  }

  async findByIdOrFail(id: string, storeId: string): Promise<ShippingRateEntity> {
    const rate = await this.repository.findOne({
      where: { id, store_id: storeId } as any,
    });
    if (!rate) {
      throw new Error(`Shipping rate ${id} not found for store ${storeId}`);
    }
    return rate;
  }

  async findRatesByZone(zone: string, storeId: string, active = true): Promise<ShippingRateEntity[]> {
    return this.repository.find({
      where: { zone_code: zone, store_id: storeId, active } as any,
      order: { weight_min: 'ASC', method_id: 'ASC' } as any,
    });
  }

  private generateId(): string {
    return require('crypto').randomUUID();
  }
}
