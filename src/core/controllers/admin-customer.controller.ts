/**
 * Admin Customer Controller
 *
 * Phase 5: Customers.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission). Handlers still scope
 * every query by the store from the verified token path.
 */

import { Request, Response } from 'express';
import { CustomerRepository } from '../repositories/customer.repository';
import { OrderRepository } from '../repositories/order.repositories';
import {
  toAdminCustomerSummaryDTO,
  toAdminCustomerDetailDTO,
  AdminCustomerOrderDTO,
} from '../dto/customer.admin.dto';
import { logError } from '../logging/logger';

const VALID_STATUS = ['active', 'inactive', 'banned'] as const;
type CustomerStatus = (typeof VALID_STATUS)[number];

/**
 * How many of a customer's orders the detail view returns.
 *
 * Bounded deliberately: a long-standing customer can have hundreds, and the
 * record exists to answer "who is this and what have they been buying", which
 * the recent history answers. The full history belongs in the orders console,
 * filtered by customer.
 */
const ORDER_HISTORY_LIMIT = 20;

function parseIntOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AdminCustomerController {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly orders: OrderRepository,
  ) {}

  /** GET /customers — list with purchase rollups. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const page = Math.max(parseIntOr(req.query['page'], 1), 1);
      const limit = Math.min(Math.max(parseIntOr(req.query['limit'], 25), 1), 100);

      const rawSort = String(req.query['sort'] ?? 'created_at');
      const sort = (['created_at', 'lifetime_value', 'order_count'] as const).includes(
        rawSort as never,
      )
        ? (rawSort as 'created_at' | 'lifetime_value' | 'order_count')
        : 'created_at';

      const { rows, total } = await this.customers.searchCustomers(storeId, {
        status: (req.query['status'] as string) || undefined,
        search: (req.query['search'] as string) || undefined,
        sort,
        direction: req.query['direction'] === 'asc' ? 'ASC' : 'DESC',
        limit,
        offset: (page - 1) * limit,
      });

      res.status(200).json({
        success: true,
        data: {
          customers: rows.map(toAdminCustomerSummaryDTO),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(Math.ceil(total / limit), 1),
          },
        },
      });
    } catch (error) {
      logError('admin_customer_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load customers' });
    }
  }

  /** GET /customers/status-counts */
  async statusCounts(req: Request, res: Response): Promise<void> {
    try {
      const counts = await this.customers.statusCounts(req.params.storeId);
      const complete = VALID_STATUS.reduce<Record<string, number>>((acc, status) => {
        acc[status] = counts[status] ?? 0;
        return acc;
      }, {});
      res.status(200).json({ success: true, data: complete });
    } catch (error) {
      logError('admin_customer_counts_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load customer counts' });
    }
  }

  /** GET /customers/:customerId — record with recent purchase history. */
  async detail(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, customerId } = req.params;

      const customer = await this.customers.findOneScoped(customerId, storeId);
      if (!customer) {
        // Also the response for an erased record: there is no admin workflow
        // that needs to read a soft-deleted customer back.
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }

      const [summary, history] = await Promise.all([
        this.customers.purchaseSummary(customerId, storeId),
        this.orders.findByCustomer(customerId, storeId, ORDER_HISTORY_LIMIT, 0),
      ]);

      const orders: AdminCustomerOrderDTO[] = history.map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        total: Number(order.total ?? 0),
        placedAt: order.created_at,
      }));

      res.status(200).json({
        success: true,
        data: toAdminCustomerDetailDTO(customer, summary, orders),
      });
    } catch (error) {
      logError('admin_customer_detail_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load customer' });
    }
  }

  /**
   * POST /customers/:customerId/status
   * Body: { status: 'active' | 'inactive' | 'banned' }
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, customerId } = req.params;
      const next = req.body?.status as CustomerStatus | undefined;

      if (!next || !VALID_STATUS.includes(next)) {
        res.status(400).json({
          success: false,
          error: `status must be one of: ${VALID_STATUS.join(', ')}`,
        });
        return;
      }

      const current = await this.customers.findOneScoped(customerId, storeId);
      if (!current) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }

      if (current.status === next) {
        res.status(409).json({ success: false, error: `Customer is already ${next}` });
        return;
      }

      const updated = await this.customers.setStatus(customerId, storeId, next);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }

      const summary = await this.customers.purchaseSummary(customerId, storeId);
      res.status(200).json({
        success: true,
        data: toAdminCustomerDetailDTO(updated, summary, []),
      });
    } catch (error) {
      logError('admin_customer_status_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update customer status' });
    }
  }
}
