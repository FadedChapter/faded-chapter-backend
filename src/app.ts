/**
 * Main Application Setup
 * Express server configuration and middleware initialization
 *
 * Phase 3: API Layer
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './core/config/env.js';
import { logger } from './core/logging/logger.js';
import { storeContextMiddleware } from './core/store/store-context.js';
import { errorHandler } from './core/middleware/error-handler.middleware.js';
import { registerCoreRoutes } from './core/routes/index.js';
import { getDataSource } from './core/database/data-source.js';
import { PaymentRepository, RefundRepository } from './core/repositories/payment.repositories.js';
import { PaymentProcessingService } from './core/services/payment-processing.service.js';
import { RefundService } from './core/services/refund.service.js';
import { RazorpayIntegrationService } from './core/services/razorpay-integration.service.js';
import { WebhookHandlerService } from './core/services/webhook-handler.service.js';

/**
 * Create Express application
 */
export function createApp(): Express {
  const app = express();

  // ============================================================================
  // Security Middleware
  // ============================================================================
  app.use(helmet());
  app.use(cors({
    origin: env.get('CORS_ORIGINS')?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));

  // ============================================================================
  // Request Parsing Middleware
  // ============================================================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // ============================================================================
  // Request Logging
  // ============================================================================
  app.use((req: Request, res: Response, next) => {
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // ============================================================================
  // Store Context Middleware (CRITICAL: Must be before routes)
  // ============================================================================
  app.use(storeContextMiddleware);

  // ============================================================================
  // Health Check Endpoint
  // ============================================================================
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ============================================================================
  // Initialize Services for Route Registration
  // ============================================================================
  let paymentServices: { payment?: any; refund?: any; webhook?: any; razorpay?: any } = {};

  try {
    const dataSource = getDataSource();
    if (dataSource.isInitialized) {
      const paymentRepo = dataSource.getRepository('payments').manager.getCustomRepository(
        PaymentRepository
      );
      const refundRepo = dataSource.getRepository('refunds').manager.getCustomRepository(
        RefundRepository
      );
      const razorpayService = new RazorpayIntegrationService();

      paymentServices.payment = new PaymentProcessingService(paymentRepo, refundRepo, razorpayService);
      paymentServices.refund = new RefundService(refundRepo, paymentRepo);
      paymentServices.webhook = new WebhookHandlerService(paymentRepo, refundRepo, razorpayService);
      paymentServices.razorpay = razorpayService;

      logger.info('Payment and webhook services initialized');
    }
  } catch (error) {
    logger.warn('Failed to initialize payment services', {
      error: (error as Error).message,
    });
  }

  // ============================================================================
  // API Routes
  // ============================================================================
  registerCoreRoutes(app, paymentServices);

  // ============================================================================
  // 404 Handler
  // ============================================================================
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    });
  });

  // ============================================================================
  // Error Handler Middleware (CRITICAL: Must be last)
  // ============================================================================
  app.use(errorHandler());

  return app;
}

/**
 * Start server
 */
export async function startServer(): Promise<void> {
  const app = createApp();
  const port = env.get('PORT') || 3000;

  app.listen(port, () => {
    logger.info(`Server started`, { port, environment: env.get('NODE_ENV') });
  });
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  });
}
