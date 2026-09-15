/**
 * Faded Chapter Backend API
 * Express.js server for authentication and order management
 *
 * Phase 3F.1: Session Infrastructure ✅
 * Phase 3F.2: Auth Endpoints (IN PROGRESS)
 * Phase 3F.3: Shopify OAuth (PLANNED)
 * Phase 3F.4: Order Retrieval (PLANNED)
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'node:crypto';

// Core services
import { createSessionMiddleware } from './core/session/middleware/session.middleware.js';
import { InMemorySessionStore } from './core/session/adapters/inmemory-session-store.js';
import { DEFAULT_SESSION_CONFIG } from './core/session/session.types.js';
import { InMemoryUserStore } from './core/user/adapters/inmemory-user-store.js';
import { createCsrfMiddleware, csrfTokenHandler } from './core/security/middleware/csrf.middleware.js';

// Routes & Services (Phase 9 & 10a: Payment Processing & Admin Dashboard)
import { createAuthRoutes } from './routes/auth.routes.js';
import { createOrdersRoutes } from './routes/orders.routes.js';
import { registerCoreRoutes } from './core/routes/index.js';

// ============================================================================
// Initialize Stores
// ============================================================================

/**
 * Phase 3F.1: Session Store
 * Using in-memory store for development.
 * TODO: Replace with database-backed store for production.
 */
const sessionStore = new InMemorySessionStore(DEFAULT_SESSION_CONFIG);

/**
 * Phase 3F.2: User Store
 * Using in-memory store for development with real password hashing.
 * TODO: Replace with database-backed store for production.
 */
const userStore = new InMemoryUserStore();

// ============================================================================
// Express App Setup
// ============================================================================

const app: Express = express();
const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3000;

// ============================================================================
// Initialize Core Systems (MUST happen before routes)
// ============================================================================
import { initializeLogger } from './core/logging/logger.js';
import { loadConfig } from './core/config/env.js';

// Load environment configuration
loadConfig();

// Initialize logger
initializeLogger();

// Initialize TypeORM DataSource for payment/refund services
import { initializeDatabase } from './core/database/postgres-data-source.js';
try {
  initializeDatabase().catch(err => {
    console.error('Warning: Database initialization failed, some features may not work:', err);
  });
} catch (err) {
  console.error('Warning: Could not initialize database:', err);
}

// Security headers (with CORS support for development)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS middleware - Allow frontend to communicate with backend
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || 'http://localhost:4201';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Request-Timestamp, X-Request-Nonce');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Request body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cookie parsing
app.use(cookieParser());

// Per-request CSP nonce — must run before helmet so the nonce is on res.locals
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.locals['nonce'] = randomBytes(16).toString('base64url');
  next();
});

// ============================================================================
// Middleware
// ============================================================================

// Session middleware (Phase 3F.1)
app.use(createSessionMiddleware(sessionStore, DEFAULT_SESSION_CONFIG));

// CSRF middleware (Phase 3F.1, hardened in Phase 0).
// Double-submit cookie: state-changing cookie-authenticated requests must echo
// the csrf-token cookie in X-CSRF-Token. Bearer-authenticated calls are exempt
// (no ambient credential to abuse).
app.use(createCsrfMiddleware());

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// CSRF bootstrap: lets a client obtain a token before its first mutation.
app.get('/api/csrf-token', csrfTokenHandler);

// Auth routes (Phase 3F.2)
app.use('/api/auth', createAuthRoutes(userStore, sessionStore, DEFAULT_SESSION_CONFIG));

// Orders routes (Phase 3F.4)
app.use('/api/orders', createOrdersRoutes());

// Payment & Dashboard routes (Phase 9 & 10a)
// Includes: payments, refunds, dashboard, webhooks
// Note: Payment services use PostgreSQL (separate from session SQLite store)
registerCoreRoutes(app);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handler (must be last)
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Error:', error);
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : error.message,
    },
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Faded Chapter Backend API                                 ║
║  http://localhost:${PORT}                             ║
║  Environment: ${process.env['NODE_ENV'] || 'development'}                        ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
