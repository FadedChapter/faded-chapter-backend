/**
 * Prometheus Metrics
 * Application performance and business metrics
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';

// HTTP request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
});

export const dbConnectionPoolSize = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Database connection pool size',
});

export const dbConnectionPoolActive = new Gauge({
  name: 'db_connection_pool_active',
  help: 'Active database connections in pool',
});

// Business metrics
export const ordersCreated = new Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['store_id'],
});

export const ordersTotalValue = new Gauge({
  name: 'orders_total_value',
  help: 'Total value of all orders',
  labelNames: ['store_id', 'currency'],
});

export const paymentProcessed = new Counter({
  name: 'payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['status', 'payment_method'],
});

export const customersRegistered = new Counter({
  name: 'customers_registered_total',
  help: 'Total number of customer registrations',
  labelNames: ['store_id'],
});

export const auditLogsCreated = new Counter({
  name: 'audit_logs_created_total',
  help: 'Total number of audit log entries',
  labelNames: ['action', 'store_id'],
});

// Error metrics
export const errorTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route'],
});

export const authenticationFailures = new Counter({
  name: 'authentication_failures_total',
  help: 'Total authentication failures',
  labelNames: ['reason'],
});

export const rateLimitExceeded = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total rate limit exceeded events',
  labelNames: ['endpoint'],
});

// Application metrics
export const appStartup = new Counter({
  name: 'app_startup_total',
  help: 'Application startup count',
});

export const appUptime = new Gauge({
  name: 'app_uptime_seconds',
  help: 'Application uptime in seconds',
});

// Export metrics in Prometheus format
export function getMetrics(): string {
  return register.metrics();
}

// Helper to start metrics collection
export function initializeMetrics(): void {
  appStartup.inc();

  // Update uptime every 10 seconds
  setInterval(() => {
    appUptime.set(process.uptime());
  }, 10000);
}
