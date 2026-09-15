/**
 * Admin Discount Controller
 *
 * Phase 8: Discounts & Promotions.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission).
 *
 * A promo code is spendable value. Creating one is closer to issuing credit
 * than to editing a product, which is why every mutation here is admin-only and
 * audited, and why the validation below is stricter than the column types
 * require.
 */

import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDataSource } from '../database/postgres-data-source';
import { PromoCodeEntity } from '../entities/index';
import { toAdminPromoCodeDTO, PromoRedemptionDTO } from '../dto/discount.dto';
import { logError, logInfo } from '../logging/logger';

const DISCOUNT_TYPES = ['percentage', 'fixed', 'free_shipping'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];

const STATUSES = ['active', 'inactive', 'expired'] as const;

/** Codes are typed by customers, so keep them unambiguous to read aloud. */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

function parseIntOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AdminDiscountController {
  private get repo() {
    return getDataSource().getRepository(PromoCodeEntity);
  }

  /** GET /discounts — all promo codes for the store. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const page = Math.max(parseIntOr(req.query['page'], 1), 1);
      const limit = Math.min(Math.max(parseIntOr(req.query['limit'], 25), 1), 100);
      const status = (req.query['status'] as string) || undefined;
      const search = (req.query['search'] as string) || undefined;

      const qb = this.repo
        .createQueryBuilder('p')
        .where('p.store_id = :storeId', { storeId });

      if (status) qb.andWhere('p.status = :status', { status });
      if (search?.trim()) {
        const term = `%${search.trim()}%`;
        qb.andWhere('(p.code ILIKE :term OR p.description ILIKE :term)', { term });
      }

      const total = await qb.getCount();
      const rows = await qb
        .orderBy('p.created_at', 'DESC')
        .take(limit)
        .skip((page - 1) * limit)
        .getMany();

      res.status(200).json({
        success: true,
        data: {
          discounts: rows.map(toAdminPromoCodeDTO),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
          },
        },
      });
    } catch (error) {
      logError('admin_discount_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load discounts' });
    }
  }

  /** GET /discounts/redemptions — value actually given away, per code. */
  async redemptions(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const rows: PromoRedemptionDTO[] = await getDataSource().manager.query(
        `
        SELECT
          p.id                                    AS "promoCodeId",
          p.code                                  AS code,
          COUNT(d.id)::int                        AS redemptions,
          COALESCE(SUM(d.discount_amount), 0)::float AS "discountGiven"
        FROM promo_codes p
        LEFT JOIN discount_applications d
          ON d.promo_code_id = p.id AND d.store_id = p.store_id
        WHERE p.store_id = $1
        GROUP BY p.id, p.code
        ORDER BY "discountGiven" DESC
        `,
        [storeId],
      );

      res.status(200).json({
        success: true,
        data: rows.map((r) => ({
          ...r,
          redemptions: Number(r.redemptions),
          discountGiven: Number(r.discountGiven),
        })),
      });
    } catch (error) {
      logError('admin_discount_redemptions_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load redemptions' });
    }
  }

  /** POST /discounts — issue a new code. */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const body = req.body ?? {};
      const code = String(body.code ?? '').trim().toUpperCase();
      const discountType = body.discountType as DiscountType;
      const discountValue = Number(body.discountValue);

      if (!CODE_PATTERN.test(code)) {
        res.status(400).json({
          success: false,
          error:
            'Code must be 3-32 characters, uppercase letters, digits, hyphen or underscore',
        });
        return;
      }

      if (!DISCOUNT_TYPES.includes(discountType)) {
        res.status(400).json({
          success: false,
          error: `discountType must be one of: ${DISCOUNT_TYPES.join(', ')}`,
        });
        return;
      }

      if (discountType === 'percentage') {
        // A percentage above 100 is not a discount, it pays the customer to
        // order. The column would happily store it.
        if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) {
          res.status(400).json({
            success: false,
            error: 'A percentage discount must be greater than 0 and at most 100',
          });
          return;
        }
      } else if (discountType === 'fixed') {
        if (!Number.isFinite(discountValue) || discountValue <= 0) {
          res.status(400).json({
            success: false,
            error: 'A fixed discount must be greater than 0',
          });
          return;
        }
      }

      const usageLimit =
        body.usageLimit === null || body.usageLimit === undefined
          ? null
          : parseIntOr(body.usageLimit, -1);
      if (usageLimit !== null && usageLimit < 1) {
        res.status(400).json({
          success: false,
          error: 'usageLimit must be at least 1, or null for unlimited',
        });
        return;
      }

      const startDate = body.startDate ? new Date(body.startDate) : new Date();
      const endDate = body.endDate ? new Date(body.endDate) : null;
      if (endDate && endDate <= startDate) {
        res.status(400).json({
          success: false,
          error: 'endDate must be after startDate',
        });
        return;
      }

      // Uniqueness is enforced by a case-insensitive index, but checking first
      // turns a database error into an answerable message.
      const existing = await this.repo
        .createQueryBuilder('p')
        .where('p.store_id = :storeId', { storeId })
        .andWhere('UPPER(p.code) = :code', { code })
        .getOne();
      if (existing) {
        res.status(409).json({ success: false, error: `Code ${code} already exists` });
        return;
      }

      const created = await this.repo.save(
        this.repo.create({
          id: randomUUID(),
          store_id: storeId,
          code,
          discount_type: discountType,
          discount_value: discountValue,
          description: typeof body.description === 'string' ? body.description.slice(0, 500) : null,
          status: 'active',
          usage_limit: usageLimit,
          usage_count: 0,
          min_purchase: Number(body.minPurchase) > 0 ? Number(body.minPurchase) : 0,
          max_discount: Number(body.maxDiscount) > 0 ? Number(body.maxDiscount) : null,
          stackable: Boolean(body.stackable),
          start_date: startDate,
          end_date: endDate,
          metadata: {},
        } as Partial<PromoCodeEntity>),
      );

      // Published for the audit middleware: a create has no record id in its
      // route params, so without this the mint of a spendable code is logged
      // but never written to the audit table.
      res.locals['auditRecordId'] = created.id;

      logInfo('promo_code_created', {
        code,
        discountType,
        discountValue,
        usageLimit,
        storeId,
        actorId: req.auth?.userId ?? null,
        actorEmail: req.auth?.email ?? null,
      });

      res.status(201).json({ success: true, data: toAdminPromoCodeDTO(created) });
    } catch (error) {
      logError('admin_discount_create_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to create discount' });
    }
  }

  /**
   * POST /discounts/:discountId/status
   *
   * Deactivation rather than deletion. A code that has been redeemed is part of
   * the order record, and removing it would orphan those applications and make
   * historic totals unexplainable.
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, discountId } = req.params;
      const next = req.body?.status as string;

      if (!STATUSES.includes(next as never)) {
        res.status(400).json({
          success: false,
          error: `status must be one of: ${STATUSES.join(', ')}`,
        });
        return;
      }

      const promo = await this.repo.findOne({
        where: { id: discountId, store_id: storeId } as any,
      });
      if (!promo) {
        res.status(404).json({ success: false, error: 'Discount not found' });
        return;
      }
      if (promo.status === next) {
        res.status(409).json({ success: false, error: `Discount is already ${next}` });
        return;
      }

      await this.repo.update(
        { id: discountId, store_id: storeId } as any,
        { status: next, updated_at: new Date() } as any,
      );

      logInfo('promo_code_status_changed', {
        code: promo.code,
        from: promo.status,
        to: next,
        storeId,
        actorId: req.auth?.userId ?? null,
      });

      const updated = await this.repo.findOne({
        where: { id: discountId, store_id: storeId } as any,
      });
      res.status(200).json({ success: true, data: toAdminPromoCodeDTO(updated!) });
    } catch (error) {
      logError('admin_discount_status_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update discount' });
    }
  }
}
