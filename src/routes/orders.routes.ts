/**
 * Orders Routes (Phase 3F.3)
 *
 * Endpoint:
 * - GET /api/orders — Fetch authenticated customer's orders from Shopify
 *
 * Security:
 * - Requires authenticated session with valid shopifyCustomerId
 * - Shopify access token stored server-side, never exposed to browser
 * - Returns only orders belonging to authenticated customer
 * - Fails closed (401) if authentication missing or invalid
 * - Client cannot supply customer ID (ignored if provided)
 *
 * Authorization Boundary (Phase 3F.3):
 * - Extract shopifyCustomerId from server-side session (req.session)
 * - Use Shopify access token (also from server-side session) to fetch orders
 * - Shopify API automatically scopes to authenticated customer
 * - No local validation needed (Shopify is authoritative)
 */

import { Router } from 'express';
// Phase 3F.3: Shopify API adapter
import { getShopifyOAuthConfig } from '../app/core/shopify-api/shopify-config';
import { getShopifyCustomerAdapter } from '../app/core/shopify-api/shopify-customer.adapter';

/**
 * Create orders routes.
 * Mounted at /api/orders
 */
export function createOrdersRoutes(): Router {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const router = Router() as any;

  /**
   * GET /api/orders
   *
   * Fetch authenticated customer's orders.
   * Returns array of customer orders from Shopify.
   *
   * Security:
   * - Requires authenticated session (HTTP-only cookie)
   * - Uses server-side access token from session
   * - Client-supplied customer ID is ignored (not used for authorization)
   * - Shopify API handles customer scoping (authoritative)
   *
   * Response:
   * - 200: { ok: true, orders: [] }
   * - 401: { ok: false, error: { code, message } } if not authenticated
   * - 500: { ok: false, error: { code, message } } if Shopify API fails
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router.get('/', async (req: any, res: any) => {
    try {
      // CRITICAL: Require authenticated session
      if (!req.session) {
        return res.status(401).json({
          ok: false,
          error: { code: 'notAuthenticated', message: 'Authentication required' },
        });
      }

      // Extract authentication from server-side session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shopifyCustomerId = (req.session as any).shopifyCustomerId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shopifyAccessToken = (req.session as any).shopifyAccessToken;

      // CRITICAL: Require valid Shopify authentication
      // Missing customer ID means not a Shopify-authenticated session
      if (!shopifyCustomerId || !shopifyAccessToken) {
        console.warn('[Orders] Request missing Shopify authentication:', {
          hasCustomerId: !!shopifyCustomerId,
          hasAccessToken: !!shopifyAccessToken,
        });
        return res.status(401).json({
          ok: false,
          error: { code: 'notAuthenticated', message: 'Shopify authentication required' },
        });
      }

      // IMPORTANT: Client-supplied customer ID is NEVER used
      // Authorization is based solely on what's in the server-side session
      // If client tries to request another customer's orders, Shopify API will reject it
      // (because the access token is tied to the authenticated customer)

      // Fetch customer's orders from Shopify
      const config = getShopifyOAuthConfig();
      const adapter = getShopifyCustomerAdapter(config);

      let orders;
      try {
        orders = await adapter.getCustomerOrders(shopifyAccessToken);
      } catch (error) {
        console.error('[Orders] Shopify API error:', error instanceof Error ? error.message : error);
        return res.status(500).json({
          ok: false,
          error: { code: 'shopifyError', message: 'Failed to fetch orders' },
        });
      }

      // Return orders
      return res.json({
        ok: true,
        orders: orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          status: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          total: order.totalPrice.amount,
          currency: order.totalPrice.currencyCode,
          lineItems: order.lineItems.edges.map((edge) => ({
            id: edge.node.id,
            title: edge.node.title,
            quantity: edge.node.quantity,
            sku: edge.node.variant?.sku,
            price: edge.node.variant?.price,
          })),
        })),
      });
    } catch (error) {
      console.error('[Orders] Unexpected error:', error instanceof Error ? error.message : error);
      return res.status(500).json({
        ok: false,
        error: { code: 'unknown', message: 'Orders fetch failed' },
      });
    }
  });

  return router;
}
