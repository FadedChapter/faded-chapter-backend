/**
 * Sentry Error Tracking & Performance Monitoring
 * Captures errors, exceptions, and performance issues
 */

import * as Sentry from '@sentry/node';
import { Express } from 'express';

/**
 * Initialize Sentry for error tracking and APM
 */
export function initializeSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const tracesSampleRate = environment === 'production' ? 0.1 : 1.0;

  if (!dsn) {
    console.warn('⚠️  SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    // Ignore certain errors that are expected
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'chrome-extension://',
      'moz-extension://',
      // See http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Random expected errors
      'NetworkError',
      'CORS',
      'SecurityError',
    ],
    // Capture breadcrumbs
    maxBreadcrumbs: 50,
  });
}

/**
 * Attach Sentry middleware to Express
 */
export function attachSentryMiddleware(app: Express): void {
  // Request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());

  // Transaction middleware for APM
  app.use(Sentry.Handlers.tracingHandler());
}

/**
 * Attach Sentry error handler (must be after other handlers)
 */
export function attachSentryErrorHandler(app: Express): void {
  // Error handler must be after all other middleware
  app.use(Sentry.Handlers.errorHandler());
}

/**
 * Capture custom error with context
 */
export function captureException(
  error: Error | string,
  context?: Record<string, any>
): string | null {
  if (!process.env.SENTRY_DSN) {
    return null;
  }

  const eventId = Sentry.captureException(error);

  if (context) {
    Sentry.setContext('custom', context);
  }

  return eventId;
}

/**
 * Capture a message (info, warning, error)
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): string | null {
  if (!process.env.SENTRY_DSN) {
    return null;
  }

  return Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string, username?: string): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, any>
): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Start a transaction for APM
 */
export function startTransaction(
  name: string,
  op: string = 'http.request'
): Sentry.Transaction | null {
  if (!process.env.SENTRY_DSN) {
    return null;
  }

  return Sentry.startTransaction({
    name,
    op,
  });
}
