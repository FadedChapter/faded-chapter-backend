/**
 * Admin Shipping Controller
 *
 * Phase 9: Shipping & Logistics.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission).
 *
 * Shipping pricing is margin: every rupee under-charged on delivery comes
 * straight off the order. Mutations are therefore admin-only and audited, and
 * the validation below is stricter than the columns require.
 */

import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDataSource } from '../database/postgres-data-source';
import { ShippingMethodEntity, ShippingRateEntity } from '../entities/index';
import {
  toAdminShippingMethodDTO,
  toAdminShippingRateDTO,
} from '../dto/shipping.dto';
import { logError, logInfo } from '../logging/logger';

const METHOD_TYPES = ['ground', 'express', 'overnight', 'international', 'local'] as const;
type MethodType = (typeof METHOD_TYPES)[number];

export class AdminShippingController {
  private get methods() {
    return getDataSource().getRepository(ShippingMethodEntity);
  }
  private get rates() {
    return getDataSource().getRepository(ShippingRateEntity);
  }

  /** GET /shipping — methods with their rate counts. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;

      const methods = await this.methods.find({
        where: { store_id: storeId } as any,
        order: { base_cost: 'ASC' } as any,
      });

      // One grouped count rather than a query per method.
      const counts = await this.rates
        .createQueryBuilder('r')
        .select('r.method_id', 'methodId')
        .addSelect('COUNT(*)', 'count')
        .where('r.store_id = :storeId', { storeId })
        .groupBy('r.method_id')
        .getRawMany<{ methodId: string; count: string }>();

      const byMethod = new Map(counts.map((c) => [c.methodId, Number(c.count)]));

      res.status(200).json({
        success: true,
        data: methods.map((m) => toAdminShippingMethodDTO(m, byMethod.get(m.id) ?? 0)),
      });
    } catch (error) {
      logError('admin_shipping_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load shipping methods' });
    }
  }

  /** GET /shipping/:methodId/rates — the rate card for one method. */
  async rateCard(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, methodId } = req.params;

      const method = await this.methods.findOne({
        where: { id: methodId, store_id: storeId } as any,
      });
      if (!method) {
        res.status(404).json({ success: false, error: 'Shipping method not found' });
        return;
      }

      const rates = await this.rates.find({
        where: { method_id: methodId, store_id: storeId } as any,
        order: { zone_code: 'ASC', weight_min: 'ASC' } as any,
      });

      res.status(200).json({
        success: true,
        data: {
          method: toAdminShippingMethodDTO(method, rates.length),
          rates: rates.map(toAdminShippingRateDTO),
        },
      });
    } catch (error) {
      logError('admin_shipping_ratecard_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load rate card' });
    }
  }

  /** POST /shipping — create a delivery method. */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const body = req.body ?? {};
      const name = String(body.name ?? '').trim();
      const type = body.type as MethodType;
      const baseCost = Number(body.baseCost);
      const min = Number(body.estDaysMin);
      const max = Number(body.estDaysMax);

      if (name.length < 2 || name.length > 120) {
        res.status(400).json({ success: false, error: 'Name must be 2-120 characters' });
        return;
      }
      if (!METHOD_TYPES.includes(type)) {
        res.status(400).json({
          success: false,
          error: `type must be one of: ${METHOD_TYPES.join(', ')}`,
        });
        return;
      }
      // Zero is allowed — free shipping is a real offer. Negative is not: it
      // would pay the customer to choose a delivery option.
      if (!Number.isFinite(baseCost) || baseCost < 0) {
        res.status(400).json({ success: false, error: 'baseCost must be zero or greater' });
        return;
      }
      if (!Number.isInteger(min) || min < 0 || !Number.isInteger(max) || max < 0) {
        res.status(400).json({
          success: false,
          error: 'Delivery estimates must be whole numbers of days, zero or greater',
        });
        return;
      }
      if (max < min) {
        // A window that ends before it starts cannot be shown to a customer.
        res.status(400).json({
          success: false,
          error: 'estDaysMax must be greater than or equal to estDaysMin',
        });
        return;
      }

      const created = await this.methods.save(
        this.methods.create({
          id: randomUUID(),
          store_id: storeId,
          name,
          description:
            typeof body.description === 'string' ? body.description.slice(0, 500) : null,
          type,
          base_cost: baseCost,
          est_days_min: min,
          est_days_max: max,
          active: body.active !== false,
          metadata: {
            carrier: typeof body.carrier === 'string' ? body.carrier : null,
            serviceCode: typeof body.serviceCode === 'string' ? body.serviceCode : null,
          },
        } as Partial<ShippingMethodEntity>),
      );

      // Published for the audit middleware: a create has no id in its params.
      res.locals['auditRecordId'] = created.id;

      logInfo('shipping_method_created', {
        methodId: created.id,
        name,
        type,
        baseCost,
        storeId,
        actorId: req.auth?.userId ?? null,
      });

      res.status(201).json({ success: true, data: toAdminShippingMethodDTO(created, 0) });
    } catch (error) {
      logError('admin_shipping_create_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to create shipping method' });
    }
  }

  /**
   * POST /shipping/:methodId/availability
   * Body: { active: boolean }
   *
   * Methods are retired, never deleted: past orders reference the method they
   * shipped on, and removing it would make historic fulfilment unreadable.
   */
  async setAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, methodId } = req.params;
      const active = req.body?.active;

      if (typeof active !== 'boolean') {
        res.status(400).json({ success: false, error: 'active must be true or false' });
        return;
      }

      const method = await this.methods.findOne({
        where: { id: methodId, store_id: storeId } as any,
      });
      if (!method) {
        res.status(404).json({ success: false, error: 'Shipping method not found' });
        return;
      }
      if (Boolean(method.active) === active) {
        res.status(409).json({
          success: false,
          error: `Method is already ${active ? 'available' : 'retired'}`,
        });
        return;
      }

      await this.methods.update(
        { id: methodId, store_id: storeId } as any,
        { active, updated_at: new Date() } as any,
      );

      logInfo('shipping_method_availability_changed', {
        methodId,
        name: method.name,
        active,
        storeId,
        actorId: req.auth?.userId ?? null,
      });

      const updated = await this.methods.findOne({
        where: { id: methodId, store_id: storeId } as any,
      });
      const rateCount = await this.rates.count({
        where: { method_id: methodId, store_id: storeId } as any,
      });

      res.status(200).json({
        success: true,
        data: toAdminShippingMethodDTO(updated!, rateCount),
      });
    } catch (error) {
      logError('admin_shipping_availability_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update availability' });
    }
  }
}
