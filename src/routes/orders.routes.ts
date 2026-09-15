/**
 * Order Routes
 * REST API endpoints for order management
 * Phase 3F.6: Order Management
 */

import { Router, Request, Response } from 'express';
import { OrderService } from '../core/orders/services/order.service';
import { verifyJWT } from '../core/auth/middleware/jwt.middleware';

export function createOrdersRoutes(): Router {
  const router = Router();
  const orderService = new OrderService();

  /**
   * GET /api/orders
   * Get all orders for authenticated user
   * Query params: status, paymentStatus, limit, offset, sortBy, sortOrder
   */
  router.get('/', verifyJWT, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: {
            code: 'unauthorized',
            message: 'User ID not found in token',
          },
        });
      }

      const {
        status,
        paymentStatus,
        fulfillmentStatus,
        limit = '20',
        offset = '0',
        sortBy = 'date',
        sortOrder = 'desc',
      } = req.query;

      const { orders, total } = await orderService.getUserOrders(userId, {
        status: status as any,
        paymentStatus: paymentStatus as any,
        fulfillmentStatus: fulfillmentStatus as any,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      return res.json({
        ok: true,
        data: {
          orders,
          pagination: {
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: parseInt(offset as string) + parseInt(limit as string) < total,
          },
        },
      });
    } catch (error) {
      console.error('[Orders] Error fetching orders:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'fetchFailed',
          message: 'Failed to fetch orders',
        },
      });
    }
  });

  /**
   * GET /api/orders/stats
   * Get order statistics for authenticated user
   */
  router.get('/stats', verifyJWT, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: {
            code: 'unauthorized',
            message: 'User ID not found in token',
          },
        });
      }

      const stats = await orderService.getOrderStats(userId);

      return res.json({
        ok: true,
        data: stats,
      });
    } catch (error) {
      console.error('[Orders] Error fetching stats:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'statsFailed',
          message: 'Failed to fetch order statistics',
        },
      });
    }
  });

  /**
   * GET /api/orders/:id
   * Get a single order by ID
   */
  router.get('/:id', verifyJWT, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: {
            code: 'unauthorized',
            message: 'User ID not found in token',
          },
        });
      }

      const order = await orderService.getOrderById(userId, id);

      if (!order) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'notFound',
            message: 'Order not found',
          },
        });
      }

      return res.json({
        ok: true,
        data: order,
      });
    } catch (error) {
      console.error('[Orders] Error fetching order:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'fetchFailed',
          message: 'Failed to fetch order',
        },
      });
    }
  });

  /**
   * POST /api/orders/sync
   * Manually sync orders from Shopify
   * This will be called automatically during OAuth in Phase 3F.3
   */
  router.post('/sync', verifyJWT, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: {
            code: 'unauthorized',
            message: 'User ID not found in token',
          },
        });
      }

      // Sync orders from Shopify (or mock in development)
      const orders = await orderService.syncOrdersFromShopify(userId);

      return res.json({
        ok: true,
        data: {
          synced: orders.length,
          orders,
          message: `Successfully synced ${orders.length} orders`,
        },
      });
    } catch (error) {
      console.error('[Orders] Error syncing orders:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'syncFailed',
          message: 'Failed to sync orders from Shopify',
        },
      });
    }
  });

  return router;
}
