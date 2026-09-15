/**
 * Admin Order Controller
 *
 * Phase 2: Orders.
 *
 * Serves the operations order queue. Every response goes through the order DTOs
 * so entities are never serialised directly.
 *
 * Authorisation is not performed here — the admin router applies
 * authenticate → role → store-ownership → permission before any handler runs.
 * Handlers may assume `req.auth` is present and already authorised for the
 * declared permission, and must still scope every query by the store from the
 * verified token path.
 */

import { Request, Response } from 'express';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';
import {
  toAdminOrderSummaryDTO,
  toAdminOrderDetailDTO,
} from '../dto/order.dto';
import { logError } from '../logging/logger';

const VALID_STATUS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = (typeof VALID_STATUS)[number];

/**
 * Permitted status transitions.
 *
 * Encoded rather than left to the caller: an order queue where any status can
 * jump to any other produces states the fulfilment and finance flows cannot
 * reconcile (a delivered order returning to pending, a cancelled order
 * shipping). Terminal states have no exits.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseIntOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AdminOrderController {
  constructor(
    private readonly orders: OrderRepository,
    private readonly lines: OrderLineRepository,
  ) {}

  /** GET /orders — filtered, searchable, paginated queue. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const page = Math.max(parseIntOr(req.query['page'], 1), 1);
      const limit = Math.min(Math.max(parseIntOr(req.query['limit'], 25), 1), 100);

      const { rows, total, itemCounts } = await this.orders.searchOrders(storeId, {
        status: (req.query['status'] as string) || undefined,
        paymentStatus: (req.query['paymentStatus'] as string) || undefined,
        fulfillmentStatus: (req.query['fulfillmentStatus'] as string) || undefined,
        search: (req.query['search'] as string) || undefined,
        from: parseDate(req.query['from']),
        to: parseDate(req.query['to']),
        sort: (req.query['sort'] as 'created_at' | 'total' | 'order_number') || 'created_at',
        direction: req.query['direction'] === 'asc' ? 'ASC' : 'DESC',
        limit,
        offset: (page - 1) * limit,
      });

      res.status(200).json({
        success: true,
        data: {
          orders: rows.map((order) => toAdminOrderSummaryDTO(order, itemCounts.get(order.id))),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
          },
        },
      });
    } catch (error) {
      logError('admin_order_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load orders' });
    }
  }

  /** GET /orders/status-counts — queue tab counts. */
  async statusCounts(req: Request, res: Response): Promise<void> {
    try {
      const counts = await this.orders.countByAllStatuses(req.params.storeId);
      const complete = VALID_STATUS.reduce<Record<string, number>>((acc, status) => {
        acc[status] = counts[status] ?? 0;
        return acc;
      }, {});
      res.status(200).json({ success: true, data: complete });
    } catch (error) {
      logError('admin_order_counts_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load order counts' });
    }
  }

  /** GET /orders/:orderId */
  async detail(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const order = await this.orders.findOneScoped(orderId, storeId, ['lines']);
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }
      res.status(200).json({ success: true, data: toAdminOrderDetailDTO(order) });
    } catch (error) {
      logError('admin_order_detail_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load order' });
    }
  }

  /**
   * POST /orders/:orderId/status
   * Applies a status transition, rejecting moves that are not permitted.
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const next = req.body?.status as OrderStatus | undefined;

      if (!next || !VALID_STATUS.includes(next)) {
        res.status(400).json({
          success: false,
          error: `status must be one of: ${VALID_STATUS.join(', ')}`,
        });
        return;
      }

      const order = await this.orders.findOneScoped(orderId, storeId, []);
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const current = order.status as OrderStatus;
      if (current === next) {
        res.status(409).json({ success: false, error: `Order is already ${next}` });
        return;
      }

      const permitted = ALLOWED_TRANSITIONS[current] ?? [];
      if (!permitted.includes(next)) {
        res.status(409).json({
          success: false,
          error: permitted.length
            ? `Cannot move an order from ${current} to ${next}. Allowed: ${permitted.join(', ')}`
            : `${current} is a terminal status and cannot be changed`,
        });
        return;
      }

      const updated = await this.orders.applyStatusTransition(orderId, storeId, next);
      res.status(200).json({ success: true, data: toAdminOrderDetailDTO(updated) });
    } catch (error) {
      logError('admin_order_status_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
  }

  /** PATCH /orders/:orderId/notes — internal operator notes. */
  async updateNotes(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const notes = req.body?.notes;
      if (typeof notes !== 'string') {
        res.status(400).json({ success: false, error: 'notes must be a string' });
        return;
      }

      const order = await this.orders.findOneScoped(orderId, storeId, ['lines']);
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const updated = await this.orders.setNotes(orderId, storeId, notes.slice(0, 2000));
      res.status(200).json({ success: true, data: toAdminOrderDetailDTO(updated) });
    } catch (error) {
      logError('admin_order_notes_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update notes' });
    }
  }
}
