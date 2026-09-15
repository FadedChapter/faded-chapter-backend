/**
 * Order Management Controllers
 * HTTP request handlers for order domain
 *
 * Phase 5: Order Management Domain
 */

import { Request, Response } from 'express';
import { OrderService, OrderLineService } from '../services/order.service';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderLineDto,
  MarkAsPaidDto,
  MarkAsShippedDto,
  FulfillLineDto,
} from '../dtos/order.dto';

/**
 * Order Controller
 */
export class OrderController {
  constructor(
    private orderService: OrderService,
    private lineService: OrderLineService
  ) {}

  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const dto = req.body as CreateOrderDto;

      const order = await this.orderService.createOrder(storeId, dto);
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const order = await this.orderService.getOrder(storeId, orderId);
      res.status(200).json(order);
    } catch (error) {
      res.status(404).json({ error: 'Order not found' });
    }
  }

  async getOrderByNumber(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const orderNumber = req.query.number as string;

      if (!orderNumber) {
        res.status(400).json({ error: 'Order number required' });
        return;
      }

      const order = await this.orderService.getOrderByNumber(storeId, orderNumber);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.status(200).json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const customerId = req.query.customerId as string;
      const status = req.query.status as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      let orders;

      if (customerId) {
        orders = await this.orderService.listOrdersByCustomer(customerId, storeId, limit, offset);
      } else if (status) {
        orders = await this.orderService.listOrdersByStatus(status, storeId, limit, offset);
      } else {
        // Return all orders by default
        orders = await this.orderService.getPendingOrders(storeId);
      }

      res.status(200).json(orders);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async updateOrder(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const dto = req.body as UpdateOrderDto;

      const order = await this.orderService.updateOrder(storeId, orderId, dto);
      res.status(200).json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async markAsPaid(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const dto = req.body as MarkAsPaidDto;

      const order = await this.orderService.markAsPaid(storeId, orderId, dto);
      res.status(200).json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async markAsShipped(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const dto = req.body as MarkAsShippedDto;

      const order = await this.orderService.markAsShipped(storeId, orderId, dto);
      res.status(200).json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const { reason } = req.body;

      const order = await this.orderService.cancelOrder(storeId, orderId, reason);
      res.status(200).json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getOrderLines(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const lines = await this.lineService.getLinesByOrder(orderId, storeId);
      res.status(200).json(lines);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async updateOrderLine(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId, lineId } = req.params;
      const dto = req.body as UpdateOrderLineDto;

      const line = await this.lineService.updateLine(storeId, lineId, dto);
      res.status(200).json(line);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async fulfillOrderLine(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId, lineId } = req.params;
      const dto = req.body as FulfillLineDto;

      const line = await this.lineService.fulfillLine(storeId, lineId, dto);
      res.status(200).json(line);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getUnfulfilledLines(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const lines = await this.lineService.getUnfulfilledLines(storeId);
      res.status(200).json(lines);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getTotalRevenue(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const revenue = await this.orderService.getTotalRevenue(storeId);
      res.status(200).json({ revenue });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
