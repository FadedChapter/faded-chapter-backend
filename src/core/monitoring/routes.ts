/**
 * Monitoring Routes
 * Health checks, metrics, and diagnostics endpoints
 */

import { Router, Request, Response } from 'express';
import { getMetrics } from './metrics';
import { getLiveness, getReadiness, getDetailedHealth } from './health';

const router = Router();

/**
 * GET /health/live
 * Liveness probe - is the application alive?
 * Use in Kubernetes liveness probe
 */
router.get('/health/live', (req: Request, res: Response) => {
  const liveness = getLiveness();
  res.status(200).json(liveness);
});

/**
 * GET /health/ready
 * Readiness probe - is the application ready to accept traffic?
 * Use in Kubernetes readiness probe
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    const readiness = await getReadiness();
    const statusCode = readiness.status === 'healthy' ? 200 : readiness.status === 'degraded' ? 503 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health
 * Combined health status
 * Quick check if everything is OK
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const readiness = await getReadiness();
    res.status(readiness.status === 'healthy' ? 200 : 503).json({
      status: readiness.status,
      timestamp: readiness.timestamp,
      uptime: readiness.uptime,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health/detailed
 * Comprehensive health diagnostics
 * Internal use only - includes sensitive information
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const health = await getDetailedHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /metrics
 * Prometheus metrics in text format
 * Use with Prometheus scraper
 */
router.get('/metrics', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8; version=0.0.4');
  res.send(getMetrics());
});

/**
 * GET /metrics/health
 * Health-related metrics only (smaller payload)
 */
router.get('/metrics/health', async (req: Request, res: Response) => {
  try {
    const readiness = await getReadiness();
    const metrics = {
      uptime: process.uptime(),
      memory_heap_used_mb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
      memory_heap_total_mb: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2),
      database_status: readiness.checks.database,
      overall_status: readiness.status,
    };
    res.json(metrics);
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health/startup
 * Startup probe - used when app is starting up
 * For long-running initialization processes
 */
router.get('/health/startup', async (req: Request, res: Response) => {
  try {
    const readiness = await getReadiness();
    const isReady = readiness.status !== 'unhealthy';
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      uptime: readiness.uptime,
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
