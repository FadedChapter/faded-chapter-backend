/**
 * Monitoring Middleware
 * Captures metrics for HTTP requests, errors, and performance
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  httpRequestDuration,
  httpRequestTotal,
  errorTotal,
  rateLimitExceeded,
} from './metrics';

/**
 * Middleware to generate and attach request ID
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] || uuidv4();
  (req as any).id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

/**
 * Middleware to capture HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture original send function
  const originalSend = res.send;

  res.send = function (data: any) {
    // Normalize route - replace IDs with placeholders
    const route = req.route?.path || req.path;
    const normalizedRoute = route
      .replace(/\/[a-f0-9\-]{36}/g, '/:id') // UUID
      .replace(/\/\d+/g, '/:id'); // Numbers

    const duration = (Date.now() - startTime) / 1000;
    const statusCode = res.statusCode;

    // Record metrics
    httpRequestDuration.labels(req.method, normalizedRoute, statusCode).observe(duration);
    httpRequestTotal.labels(req.method, normalizedRoute, statusCode).inc();

    // Track errors
    if (statusCode >= 400) {
      errorTotal.labels(statusCode.toString(), normalizedRoute).inc();
    }

    // Track rate limiting
    if (statusCode === 429) {
      rateLimitExceeded.labels(normalizedRoute).inc();
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Middleware to add structured logging context
 */
export function loggingContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Attach context to request
  (req as any).context = {
    requestId: (req as any).id,
    userId: (req as any).customer?.id,
    storeId: (req as any).store?.id,
    timestamp: new Date().toISOString(),
  };

  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'error' : 'info';

    const logData = {
      requestId: (req as any).id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration_ms: duration,
      userId: (req as any).customer?.id,
      storeId: (req as any).store?.id,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    };

    // Log based on level - using Winston logger would be better
    if (level === 'error') {
      console.error('HTTP Request Error:', JSON.stringify(logData));
    } else if (duration > 1000) {
      console.warn('Slow HTTP Request:', JSON.stringify(logData));
    }
  });

  next();
}

/**
 * Middleware to capture request/response sizes
 */
export function requestSizeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Estimate request size
  let requestSize = 0;
  if (req.body) {
    requestSize = JSON.stringify(req.body).length;
  }

  // Attach size info
  (req as any).size = {
    request: requestSize,
  };

  // Capture response size
  const originalSend = res.send;
  res.send = function (data: any) {
    const responseSize = typeof data === 'string' ? data.length : JSON.stringify(data).length;
    res.setHeader('x-response-size', responseSize);
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Middleware to add security headers and telemetry
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Add telemetry headers
  res.setHeader('x-powered-by', 'Faded Chapter API');
  res.setHeader('x-version', process.env.npm_package_version || '1.0.0');

  // Add cache control for different endpoints
  if (req.path.includes('/dashboard') || req.path.includes('/health')) {
    res.setHeader('cache-control', 'no-cache, no-store, must-revalidate');
  }

  next();
}
