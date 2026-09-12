import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import helmet from 'helmet';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { CATALOG_PRODUCTS } from './app/features/commerce/constants/catalog.constants';
import { buildRobotsTxt } from './app/core/seo/robots-txt.util';
import { buildSitemapXml, storefrontSitemapPaths } from './app/core/seo/sitemap-xml.util';
import { resolveSiteOrigin } from './app/core/seo/site-origin.util';
import { createWebhookVerificationMiddleware } from './app/core/shopify-webhooks/shopify-webhook-verifier';
import { handleShopifyOrderWebhook } from './app/core/shopify-webhooks/shopify-order-webhook-handler';
import { getOrderStore } from './app/core/shopify-webhooks/shopify-order-persistence';
import {
  ShopifyOrderWebhookPayload,
  ShopifyWebhookTopic,
} from './app/core/shopify-webhooks/shopify-webhook.types';
import { logWebhookSecurityEvent } from './app/core/security/logging/webhook-security-logger';
import cookieParser from 'cookie-parser';
import { createSessionMiddleware } from './core/session/middleware/session.middleware';
import { InMemorySessionStore } from './core/session/adapters/inmemory-session-store';
import { DEFAULT_SESSION_CONFIG } from './core/session/session.types';
// Phase 3F.2: User authentication
import { InMemoryUserStore } from './core/user/adapters/inmemory-user-store.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createCsrfMiddleware } from './core/security/middleware/csrf.middleware.js';
// Phase 3F.3: Orders endpoint
import { createOrdersRoutes } from './routes/orders.routes.js';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Phase 3F.1: Initialize session store on startup.
 * Using in-memory store for development.
 * TODO: Replace with database-backed store for production.
 */
const sessionStore = new InMemorySessionStore(DEFAULT_SESSION_CONFIG);

/**
 * Phase 3F.2: Initialize user store on startup.
 * Using in-memory store for development (real password hashing).
 * TODO: Replace with database-backed store for production.
 */
const userStore = new InMemoryUserStore();

// Phase 3E: Initialize order persistence store on startup
let orderStoreReady = false;
(async () => {
  try {
    const storageMode = (process.env['STORAGE_MODE'] as 'memory' | 'file') || 'memory';
    const orderStorePath = process.env['ORDER_STORE_PATH'];
    await getOrderStore(storageMode, orderStorePath);
    orderStoreReady = true;
    console.log(`[Server] Order store initialized (mode: ${storageMode})`);
  } catch (error) {
    console.error('[Server] Failed to initialize order store:', error);
    // Continue without webhooks if initialization fails
  }
})();

/**
 * Per-request CSP nonce — must run before helmet so the nonce is on res.locals
 * before the Content-Security-Policy header is assembled.
 */
app.use((_req, res, next) => {
  res.locals['nonce'] = randomBytes(16).toString('base64url');
  next();
});

/**
 * Security headers — applied before every response.
 *
 * helmet sets: X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff),
 * Referrer-Policy, Permissions-Policy, HSTS (on HTTPS), and a strict CSP.
 *
 * CSP notes:
 *  - 'self' covers all app JS/CSS served from the same origin.
 *  - fonts.googleapis.com + fonts.gstatic.com are whitelisted for the
 *    Google Fonts used by the artifact design system.
 *  - style-src includes 'unsafe-inline' because Angular SSR injects critical
 *    CSS inline at render time; remove once the app moves to a nonce-based CSP.
 *  - No eval, no object, no embed.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Function directive: helmet calls this per request so the nonce set by
        // the middleware above is fresh for every response.
        scriptSrc: [
          "'self'",
          (_req, res) => `'nonce-${(res as express.Response).locals['nonce']}'`,
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://picsum.photos',
          'https://fastly.picsum.photos',
        ],
        connectSrc: ["'self'"], // Blocks external API calls (XSS/data exfiltration)
        frameSrc: ["'none'"], // No iframe embedding
        objectSrc: ["'none'"], // No Flash/plugins
        baseUri: ["'self'"], // Prevent <base> tag injection
        formAction: ["'self'"], // All form submissions to same origin
        childSrc: ["'self'"], // No external workers
        workerSrc: ["'self'"], // Web workers same-origin only
        upgradeInsecureRequests: [], // HTTPS-only in production
      },
    },
    // HSTS: 1 year, include subdomains — enable once HTTPS is confirmed end-to-end
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'sameorigin' },
    crossOriginEmbedderPolicy: false, // relaxed — no SharedArrayBuffer use
  }),
);

/**
 * Cookie parsing — required for session middleware to extract session ID.
 */
app.use(cookieParser());

/**
 * Phase 3F.1: Session middleware.
 * Attaches authenticated session to every request (if cookie present).
 */
app.use(createSessionMiddleware(sessionStore, DEFAULT_SESSION_CONFIG));

/**
 * Phase 3F.2: CSRF validation middleware.
 * Validates X-CSRF-Token header on state-changing requests (POST, PUT, DELETE, PATCH).
 * Ensures token is present (server-side validation of session-bound tokens is Phase 3F.6).
 */
app.use(createCsrfMiddleware(true));

/**
 * Phase 3F.2: Authentication routes.
 * POST /api/auth/login — User login
 * POST /api/auth/logout — User logout
 * POST /api/auth/signup — User registration
 * Phase 3F.3: Shopify OAuth
 * GET /api/auth/shopify/authorize — Initiate OAuth
 * GET /api/auth/shopify/callback — Handle OAuth callback
 */
app.use('/api/auth', createAuthRoutes(userStore, sessionStore, DEFAULT_SESSION_CONFIG));

/**
 * Phase 3F.3: Orders endpoint.
 * GET /api/orders — Authenticated customer's orders from Shopify
 *
 * Requires valid session with Shopify authentication.
 * Fails closed (401) if not authenticated.
 */
app.use('/api/orders', createOrdersRoutes());

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8').send(buildRobotsTxt(resolveSiteOrigin()));
});

app.get('/sitemap.xml', (_req, res) => {
  const slugs = CATALOG_PRODUCTS.map((product) => product.slug);
  res
    .type('application/xml; charset=utf-8')
    .send(buildSitemapXml(resolveSiteOrigin(), storefrontSitemapPaths(slugs)));
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Phase 3E: Webhook receiver for Shopify order events.
 *
 * CRITICAL: express.raw() must come FIRST to preserve the raw request body
 * for HMAC signature verification. Regular express.json() will lose the body.
 *
 * Webhook topics handled:
 * - orders/create: New order placed
 * - orders/paid: Payment confirmed/captured
 * - orders/fulfilled: Fulfillment status changed
 * - orders/cancelled: Order cancelled
 * - orders/refunded: Refund processed
 */
const webhookSecret = process.env['SHOPIFY_WEBHOOK_SECRET'];

if (webhookSecret) {
  // Preserve raw request body for signature verification

  app.post(
    '/webhooks/orders',
    express.raw({ type: 'application/json' }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createWebhookVerificationMiddleware(webhookSecret) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (req: any, res: any) => {
      // Extract webhook metadata early for error logging
      const topic = req.shopifyWebhook?.topic as ShopifyWebhookTopic | undefined;
      const webhookId = req.shopifyWebhook?.webhookId as string | undefined;

      try {
        if (!orderStoreReady) {
          console.warn('[Webhook] Order store not ready yet, discarding webhook');
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Order store initializing',
          });
        }

        // Ensure we have metadata
        if (!topic || !webhookId) {
          throw new Error('Missing webhook metadata (topic or webhookId)');
        }

        // Security: Log webhook receipt
        logWebhookSecurityEvent('webhook_received', {
          webhookId,
          topic,
          valid: true,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        // Parse the payload (safe now that signature is verified)
        const payload: ShopifyOrderWebhookPayload = JSON.parse(req.body.toString('utf-8'));

        logWebhookSecurityEvent('signature_valid', {
          webhookId,
          topic,
          orderId: payload.id,
        });

        // Get the order store and process the webhook
        logWebhookSecurityEvent('processing_started', {
          webhookId,
          topic,
          orderId: payload.id,
        });

        const orderStore = await getOrderStore();
        const { order, actions, isRetry } = await handleShopifyOrderWebhook(
          topic,
          payload,
          webhookId,
          orderStore,
        );

        logWebhookSecurityEvent('processing_complete', {
          webhookId,
          topic,
          orderId: order.shopifyOrderId,
        });

        console.log(
          `[Webhook] Successfully processed. Order #${order.orderNumber}, isRetry: ${isRetry}, actions: ${actions.length}`,
        );

        // Respond with 200 OK to acknowledge receipt
        // Shopify will retry if we don't respond with 2xx within 30 seconds
        res.status(200).json({
          status: 'received',
          orderId: order.shopifyOrderId,
          orderNumber: order.orderNumber,
          topic,
          isRetry,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          actions: actions.map((a: any) => `${a.action}: ${a.result}`),
        });
      } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        logWebhookSecurityEvent('processing_error', {
          webhookId: webhookId || 'unknown',
          topic: topic || ('unknown' as ShopifyWebhookTopic),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't respond with 200 so Shopify retries
        res.status(500).json({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  console.log('[Server] Webhook endpoint registered at POST /webhooks/orders');
} else {
  console.warn(
    '[Server] SHOPIFY_WEBHOOK_SECRET not configured. Webhook receiver disabled. Phase 3E will not sync orders.',
  );
}

/**
 * Phase 3E: Persistent order store established (server-authoritative).
 *
 * DISABLED: GET /api/orders endpoint.
 *
 * Why disabled:
 * - No server-side authenticated customer identity exists yet (Phase 3F)
 * - Endpoint would return getAllOrders() to any browser request
 * - Would expose all customers' orders to unauthenticated callers
 * - SSR hydration would serialize all orders in HTML/TransferState
 *
 * Phase 3F (customer accounts):
 * - Establish server-side authenticated user context
 * - Implement customer filtering via LoyaltyApiPort or session
 * - Re-enable /api/orders with per-customer authorization
 *
 * Current state:
 * - Orders persisted server-side (authoritative via webhooks)
 * - OrderHistoryService uses localStorage (current, pre-3F)
 * - No customer-specific server order retrieval (intentionally deferred)
 *
 * TODO Phase 3F:
 * - add GET /api/orders/:customerId (with authentication)
 * - filter orders by customer email/ID
 * - hydrate OrderHistoryService from server on login
 * - maintain backward compatibility with localStorage fallback
 */
// INTENTIONALLY DISABLED: See above comment for Phase 3F migration path
/*
app.get('/api/orders', async (_req: any, res: any) => {
  // Disabled in Phase 3E — see comment above
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Customer order retrieval requires Phase 3F authentication',
  });
});
*/

/**
 * Health check endpoint for monitoring.
 * Used by load balancers, uptime monitors, and deployment verification.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.get('/health', (_req: any, res: any) => {
  const status = orderStoreReady ? 'healthy' : 'degraded';
  res.status(orderStoreReady ? 200 : 503).json({
    status,
    server: 'running',
    orderStore: orderStoreReady ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Phase 3F: Get current authenticated user (if session exists).
 * Used by frontend to check login status on app startup.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.get('/api/auth/me', (req: any, res: any) => {
  if (!req.session) {
    return res.status(401).json({
      ok: false,
      error: { code: 'noSession', message: 'Not authenticated' },
    });
  }

  res.json({
    ok: true,
    user: {
      id: req.session.customerId,
      email: req.session.email,
    },
  });
});

/**
 * Handle all other requests by rendering the Angular application.
 *
 * The nonce generated above is passed into Angular as requestContext (for the
 * CSP_NONCE DI token → Beasties inline styles) and also stamped directly onto
 * Angular's two jsaction inline scripts via HTML post-processing, because
 * Angular's jsaction renderer does not yet read CSP_NONCE from DI.
 *
 * Scripts patched:
 *   1. <script id="ng-event-dispatch-contract">  — the jsaction library
 *   2. <script>window.__jsaction_bootstrap(…)    — the per-route event-type bootstrap
 */
app.use(async (req, res, next) => {
  const nonce = res.locals['nonce'] as string;
  const requestContext = { nonce };

  try {
    const response = await angularApp.handle(req, requestContext);
    if (!response) return next();

    // Only post-process HTML responses; all other types pass through unchanged.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return writeResponseToNodeResponse(response, res);
    }

    const raw = await response.text();
    // Regex patterns accommodate any attribute ordering Angular may emit.
    const patched = raw
      // Script 1: jsaction library (id="ng-event-dispatch-contract", any surrounding attrs).
      .replace(/<script\b([^>]*\bid="ng-event-dispatch-contract")/, `<script nonce="${nonce}" $1`)
      // Script 2: per-route bootstrap call — hash varies per route, nonce is the only option.
      .replace(/<script(?:\s[^>]*)?>window\.__jsaction_bootstrap\(/, (match) =>
        match.replace('<script', `<script nonce="${nonce}"`),
      );

    return writeResponseToNodeResponse(
      new Response(patched, { status: response.status, headers: response.headers }),
      res,
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
