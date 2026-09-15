/**
 * Cart & Checkout Controllers
 * HTTP request handlers for cart domain
 *
 * Phase 6: Cart & Checkout Domain
 */

import { Request, Response } from 'express';
import { CartService, CartLineService } from '../services/cart.service';
import {
  AddToCartDto,
  UpdateCartLineDto,
  ApplyCouponDto,
  RemoveCouponDto,
  CheckoutDto,
} from '../dtos/cart.dto';

/**
 * Cart Controller
 */
export class CartController {
  constructor(
    private cartService: CartService,
    private lineService: CartLineService
  ) {}

  async getCart(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const customerId = req.user?.id as string; // Assumes auth middleware sets req.user

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cart = await this.cartService.getOrCreateCart(customerId, storeId);
      const itemCount = await this.lineService.getItemCount(cart.id, storeId);

      res.status(200).json({
        ...cart,
        item_count: itemCount,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async addToCart(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const customerId = req.user?.id as string;
      const dto = req.body as AddToCartDto;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cart = await this.cartService.addToCart(customerId, storeId, dto);
      const itemCount = await this.lineService.getItemCount(cart.id, storeId);

      res.status(200).json({
        ...cart,
        item_count: itemCount,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async updateCartLine(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, lineId } = req.params;
      const customerId = req.user?.id as string;
      const dto = req.body as UpdateCartLineDto;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cart = await this.cartService.updateLine(customerId, storeId, lineId, dto);
      const itemCount = await this.lineService.getItemCount(cart.id, storeId);

      res.status(200).json({
        ...cart,
        item_count: itemCount,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async removeCartLine(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, lineId } = req.params;
      const customerId = req.user?.id as string;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cart = await this.cartService.removeLineItem(customerId, storeId, lineId);
      const itemCount = await this.lineService.getItemCount(cart.id, storeId);

      res.status(200).json({
        ...cart,
        item_count: itemCount,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async applyCoupon(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const customerId = req.user?.id as string;
      const dto = req.body as ApplyCouponDto;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cart = await this.cartService.applyCoupon(customerId, storeId, dto);
      const itemCount = await this.lineService.getItemCount(cart.id, storeId);

      res.status(200).json({
        ...cart,
        item_count: itemCount,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async removeCoupon(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const customerId = req.user?.id as string;
      const dto = req.body as RemoveCouponDto;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cart = await this.cartService.removeCoupon(customerId, storeId, dto);
      const itemCount = await this.lineService.getItemCount(cart.id, storeId);

      res.status(200).json({
        ...cart,
        item_count: itemCount,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async clearCart(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const customerId = req.user?.id as string;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.cartService.clearCart(customerId, storeId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async checkout(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const customerId = req.user?.id as string;
      const checkoutData = req.body as CheckoutDto;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await this.cartService.convertToOrder(customerId, storeId, checkoutData);

      res.status(201).json({
        success: true,
        cart_id: result.cartId,
        order_id: result.orderId,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getCartSummary(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const customerId = req.user?.id as string;

      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const cart = await this.cartService.getCart(storeId, customerId);
      const itemCount = await this.lineService.getItemCount(cart.id, storeId);

      res.status(200).json({
        id: cart.id,
        item_count: itemCount,
        subtotal: cart.subtotal,
        total_estimate: cart.total_estimate,
        coupon_codes: cart.coupon_codes,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
