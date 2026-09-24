/**
 * Health Check Endpoints
 * Liveness and readiness probes for Kubernetes / container orchestration
 */

import { getDataSource } from '../database/postgres-data-source';
import { logInfo, logError } from '../logging/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'healthy' | 'unhealthy';
    memory: 'healthy' | 'degraded';
  };
  services: {
    [key: string]: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      latency_ms?: number;
      message?: string;
    };
  };
}

/**
 * Liveness probe - is the application running?
 * Returns 200 if process is alive
 */
export function getLiveness(): {
  status: 'alive';
  uptime: number;
  memory: NodeJS.MemoryUsage;
} {
  return {
    status: 'alive',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}

/**
 * Readiness probe - is the application ready to accept requests?
 * Checks database connectivity and resource availability
 */
export async function getReadiness(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const checks = {
    database: 'healthy' as const,
    memory: 'healthy' as const,
  };
  const services: HealthCheckResult['services'] = {};

  // Check database connectivity
  try {
    const dataSource = getDataSource();
    if (!dataSource.isInitialized) {
      checks.database = 'unhealthy';
      services.database = {
        status: 'unhealthy',
        message: 'Database not initialized',
      };
    } else {
      const dbStart = Date.now();
      await dataSource.query('SELECT 1');
      services.database = {
        status: 'healthy',
        latency_ms: Date.now() - dbStart,
      };
    }
  } catch (error) {
    checks.database = 'unhealthy';
    services.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    logError('health_check_database_failed', error instanceof Error ? error : undefined);
  }

  // Check memory usage (degraded if > 80%)
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (heapUsedPercent > 80) {
    checks.memory = 'degraded';
    services.memory = {
      status: 'degraded',
      message: `Heap usage at ${heapUsedPercent.toFixed(1)}%`,
    };
  } else {
    services.memory = {
      status: 'healthy',
      message: `Heap usage at ${heapUsedPercent.toFixed(1)}%`,
    };
  }

  // Determine overall status
  const status =
    checks.database === 'unhealthy' ? 'unhealthy' :
    checks.memory === 'degraded' ? 'degraded' :
    'healthy';

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    services,
  };
}

/**
 * Detailed health status - comprehensive diagnostics
 */
export async function getDetailedHealth(): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: string;
    heapTotal: string;
    external: string;
    rss: string;
  };
  database: {
    connected: boolean;
    latency_ms?: number;
    error?: string;
  };
  node: {
    version: string;
    platform: string;
  };
}> {
  const memUsage = process.memoryUsage();

  let dbStatus = {
    connected: false,
    latency_ms: undefined,
    error: undefined,
  };

  try {
    const dataSource = getDataSource();
    if (dataSource.isInitialized) {
      const dbStart = Date.now();
      await dataSource.query('SELECT 1');
      dbStatus = {
        connected: true,
        latency_ms: Date.now() - dbStart,
      };
    } else {
      dbStatus.error = 'Database not initialized';
    }
  } catch (error) {
    dbStatus.error = error instanceof Error ? error.message : 'Unknown error';
  }

  const overall =
    !dbStatus.connected ? 'unhealthy' :
    (memUsage.heapUsed / memUsage.heapTotal) * 100 > 80 ? 'degraded' :
    'healthy';

  return {
    status: overall,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    },
    database: dbStatus,
    node: {
      version: process.version,
      platform: process.platform,
    },
  };
}
