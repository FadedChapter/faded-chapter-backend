/**
 * Order Management Routes
 * API endpoints for order processing, fulfillment, and tracking
 *
 * Phase 5: Order Management Domain
 */

import { Router } from 'express';
// Phase 0: administrative order operations were unauthenticated.
import { requireStaff } from '../middleware/require-staff.middleware';
import { OrderController } from '../controllers/order.controller';
import { OrderService, OrderLineService } from '../services/order.service';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';

/**
 * Create order routes
 * Called from core routes registry
 */
export function createOrderRoutes(): Router {
  const router = Router({ mergeParams: true });

  // Initialize repositories and services
  const orderRepo = new OrderRepository();
  const lineRepo = new OrderLineRepository();

  const orderService = new OrderService(orderRepo, lineRepo);
  const lineService = new OrderLineService(lineRepo);

  const orderController = new OrderController(orderService, lineService);

  /**
   * Order Routes
   * Base: /stores/:storeId/orders
   */

  // List orders (with optional filters)
  router.get('/orders', requireStaff, (req, res) => orderController.listOrders(req, res));

  // Get order by number
  router.get('/orders/search', (req, res) => orderController.getOrderByNumber(req, res));

  // Create new order
  router.post('/orders', (req, res) => orderController.createOrder(req, res));

  // Get single order
  router.get('/orders/:orderId', (req, res) => orderController.getOrder(req, res));

  // Update order
  router.put('/orders/:orderId', requireStaff, (req, res) => orderController.updateOrder(req, res));

  // Mark order as paid
  router.post('/orders/:orderId/mark-paid', requireStaff, (req, res) => orderController.markAsPaid(req, res));

  // Mark order as shipped
  router.post('/orders/:orderId/mark-shipped', requireStaff, (req, res) => orderController.markAsShipped(req, res));

  // Cancel order
  router.post('/orders/:orderId/cancel', (req, res) => orderController.cancelOrder(req, res));

  /**
   * Order Line Routes
   * Base: /stores/:storeId/orders/:orderId/lines
   */

  // Get order lines
  router.get('/orders/:orderId/lines', (req, res) => orderController.getOrderLines(req, res));

  // Update order line
  router.put('/orders/:orderId/lines/:lineId', requireStaff, (req, res) => orderController.updateOrderLine(req, res));

  // Fulfill order line
  router.post('/orders/:orderId/lines/:lineId/fulfill', requireStaff, (req, res) =>
    orderController.fulfillOrderLine(req, res)
  );

  /**
   * Fulfillment Routes
   * Base: /stores/:storeId/fulfillment
   */

  // Get unfulfilled lines
  router.get('/fulfillment/unfulfilled', requireStaff, (req, res) => orderController.getUnfulfilledLines(req, res));

  /**
   * Analytics Routes
   * Base: /stores/:storeId/analytics
   */

  // Get total revenue
  router.get('/analytics/revenue', requireStaff, (req, res) => orderController.getTotalRevenue(req, res));

  return router;
}
