/**
 * Cart & Checkout Routes
 * API endpoints for shopping cart and checkout
 *
 * Phase 6: Cart & Checkout Domain
 */

import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { CartService, CartLineService } from '../services/cart.service';
import { CartRepository, CartLineRepository } from '../repositories/cart.repositories';
import { OrderRepository, OrderLineRepository } from '../repositories/order.repositories';
import { OrderService } from '../services/order.service';

/**
 * Create cart routes
 * Called from core routes registry
 */
export function createCartRoutes(): Router {
  const router = Router({ mergeParams: true });

  // Initialize repositories and services
  const cartRepo = new CartRepository();
  const lineRepo = new CartLineRepository();
  const orderRepo = new OrderRepository();
  const orderLineRepo = new OrderLineRepository();

  const orderService = new OrderService(orderRepo, orderLineRepo);
  const cartService = new CartService(cartRepo, lineRepo, orderService);
  const lineService = new CartLineService(lineRepo);

  const cartController = new CartController(cartService, lineService);

  /**
   * Cart Routes
   * Base: /stores/:storeId/cart
   */

  // Get cart
  router.get('/cart', (req, res) => cartController.getCart(req, res));

  // Get cart summary
  router.get('/cart/summary', (req, res) => cartController.getCartSummary(req, res));

  // Add to cart
  router.post('/cart/items', (req, res) => cartController.addToCart(req, res));

  // Update cart item
  router.put('/cart/items/:lineId', (req, res) => cartController.updateCartLine(req, res));

  // Remove cart item
  router.delete('/cart/items/:lineId', (req, res) => cartController.removeCartLine(req, res));

  // Clear cart
  router.delete('/cart', (req, res) => cartController.clearCart(req, res));

  /**
   * Coupon Routes
   * Base: /stores/:storeId/cart/coupons
   */

  // Apply coupon
  router.post('/cart/coupons', (req, res) => cartController.applyCoupon(req, res));

  // Remove coupon
  router.delete('/cart/coupons', (req, res) => cartController.removeCoupon(req, res));

  /**
   * Checkout Routes
   * Base: /stores/:storeId/checkout
   */

  // Convert cart to order
  router.post('/checkout', (req, res) => cartController.checkout(req, res));

  return router;
}
