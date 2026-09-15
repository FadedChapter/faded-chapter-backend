/**
 * Admin Inventory Controller
 *
 * Phase 4: Inventory.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission). Handlers still scope
 * every query by the store from the verified token path.
 */

import { Request, Response } from 'express';
import { InventoryRepository } from '../repositories/catalog.repositories';
import { toAdminStockDTO, toAdminStockFromEntity } from '../dto/inventory.dto';
import { logError, logInfo } from '../logging/logger';

/**
 * Why stock changed.
 *
 * A bare number is unauditable: "available went from 42 to 12" does not say
 * whether the warehouse was miscounted, a pallet was damaged, or someone
 * fat-fingered a zero. Requiring a reason from a closed set makes the audit
 * trail answerable and keeps the values aggregatable — shrinkage over a quarter
 * is a query, not a reading exercise over free text.
 */
const ADJUSTMENT_REASONS = [
  'stock_count',
  'received',
  'damaged',
  'lost',
  'returned',
  'correction',
] as const;
type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** Guards a typo from becoming a five-figure write-off. */
const MAX_ADJUSTMENT_MAGNITUDE = 10_000;

function parseIntOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AdminInventoryController {
  constructor(private readonly inventory: InventoryRepository) {}

  /** GET /inventory — stock list with filter, search and pagination. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const page = Math.max(parseIntOr(req.query['page'], 1), 1);
      const limit = Math.min(Math.max(parseIntOr(req.query['limit'], 25), 1), 100);
      const rawFilter = String(req.query['filter'] ?? 'all');
      const filter = (['all', 'low', 'out'] as const).includes(rawFilter as never)
        ? (rawFilter as 'all' | 'low' | 'out')
        : 'all';

      const { rows, total } = await this.inventory.searchStock(storeId, {
        filter,
        search: (req.query['search'] as string) || undefined,
        limit,
        offset: (page - 1) * limit,
      });

      res.status(200).json({
        success: true,
        data: {
          stock: rows.map(toAdminStockDTO),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
          },
        },
      });
    } catch (error) {
      logError('admin_inventory_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load inventory' });
    }
  }

  /** GET /inventory/counts — tab counts. */
  async counts(req: Request, res: Response): Promise<void> {
    try {
      const counts = await this.inventory.stockCounts(req.params.storeId);
      res.status(200).json({ success: true, data: counts });
    } catch (error) {
      logError('admin_inventory_counts_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load inventory counts' });
    }
  }

  /**
   * POST /inventory/:variantId/adjust
   * Body: { delta: number, reason: AdjustmentReason, note?: string }
   */
  async adjust(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, variantId } = req.params;
      const delta = Number(req.body?.delta);
      const reason = req.body?.reason as AdjustmentReason | undefined;
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null;

      if (!Number.isInteger(delta) || delta === 0) {
        res.status(400).json({
          success: false,
          error: 'delta must be a non-zero integer',
        });
        return;
      }

      if (Math.abs(delta) > MAX_ADJUSTMENT_MAGNITUDE) {
        res.status(400).json({
          success: false,
          error: `delta may not exceed ${MAX_ADJUSTMENT_MAGNITUDE} units in one adjustment`,
        });
        return;
      }

      if (!reason || !ADJUSTMENT_REASONS.includes(reason)) {
        res.status(400).json({
          success: false,
          error: `reason must be one of: ${ADJUSTMENT_REASONS.join(', ')}`,
        });
        return;
      }

      // Read first so a 404 is distinguishable from a rejected adjustment,
      // and so the error can quote the actual available figure.
      const before = await this.inventory.findByVariantId(variantId, storeId);
      if (!before) {
        res.status(404).json({ success: false, error: 'Inventory record not found' });
        return;
      }

      const updated = await this.inventory.adjustStock(variantId, storeId, delta);
      if (!updated) {
        // The guard is in the UPDATE statement, so this is the only way a
        // negative result is reported — and it cannot be raced.
        res.status(409).json({
          success: false,
          error: `Adjustment would leave negative stock. Available is ${before.quantity_available}.`,
        });
        return;
      }

      // Recorded beyond the audit row: the audit table stores who and what, and
      // this carries the accounting detail (direction, reason, resulting level).
      logInfo('inventory_adjusted', {
        variantId,
        storeId,
        actorId: req.auth?.userId ?? null,
        delta,
        reason,
        note,
        availableBefore: before.quantity_available,
        availableAfter: updated.quantity_available,
      });

      const identity = await this.identityFor(variantId, storeId);
      res.status(200).json({
        success: true,
        data: toAdminStockFromEntity(updated, identity),
      });
    } catch (error) {
      logError('admin_inventory_adjust_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to adjust stock' });
    }
  }

  /**
   * PATCH /inventory/:variantId/reorder-policy
   * Body: { reorderLevel: number, reorderQuantity: number }
   */
  async setReorderPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, variantId } = req.params;
      const reorderLevel = Number(req.body?.reorderLevel);
      const reorderQuantity = Number(req.body?.reorderQuantity);

      if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
        res.status(400).json({
          success: false,
          error: 'reorderLevel must be a non-negative integer',
        });
        return;
      }
      if (!Number.isInteger(reorderQuantity) || reorderQuantity < 0) {
        res.status(400).json({
          success: false,
          error: 'reorderQuantity must be a non-negative integer',
        });
        return;
      }

      const updated = await this.inventory.setReorderPolicy(
        variantId,
        storeId,
        reorderLevel,
        reorderQuantity,
      );
      if (!updated) {
        res.status(404).json({ success: false, error: 'Inventory record not found' });
        return;
      }

      const identity = await this.identityFor(variantId, storeId);
      res.status(200).json({
        success: true,
        data: toAdminStockFromEntity(updated, identity),
      });
    } catch (error) {
      logError('admin_inventory_policy_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update reorder policy' });
    }
  }

  /**
   * Resolve the variant/product identity for a single record.
   * The inventory entity holds only variant_id, but every response names the
   * SKU and product so the client never has to make a second call to render a
   * row it just changed.
   */
  private async identityFor(
    variantId: string,
    storeId: string,
  ): Promise<{
    sku: string;
    variantName: string;
    productId: string;
    productName: string;
    productStatus: string;
  }> {
    const row = await this.inventory.findStockRow(variantId, storeId);
    return {
      sku: row?.sku ?? '',
      variantName: row?.variantName ?? '',
      productId: row?.productId ?? '',
      productName: row?.productName ?? '',
      productStatus: row?.productStatus ?? '',
    };
  }
}
