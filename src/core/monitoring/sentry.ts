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
    // http, onUncaughtException and onUnhandledRejection are all part of
    // getDefaultIntegrations() in v8+, so listing them explicitly is redundant.
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
 * Attach Sentry's Express error handler.
 *
 * Register after all routes but before any other error middleware, otherwise a
 * handler that ends the response first will stop the error ever reaching Sentry.
 *
 * There is no longer a request/tracing middleware to attach: v8+ instruments
 * Express automatically, provided initializeSentry() runs before Express is
 * imported.
 */
export function attachSentryErrorHandler(app: Express): void {
  Sentry.setupExpressErrorHandler(app);
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

  // Context has to be set on the scope before the event is captured. The
  // previous version called setContext afterwards, so it never attached.
  return Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('custom', context);
    }
    return Sentry.captureException(error);
  });
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
 * Wrap an operation in a span for APM.
 *
 * Replaces the old startTransaction(): v8+ removed free-standing transaction
 * objects, so a span's lifetime is the callback rather than something the
 * caller ends by hand.
 */
export function withSpan<T>(name: string, op: string, callback: () => T): T {
  if (!process.env.SENTRY_DSN) {
    return callback();
  }

  return Sentry.startSpan({ name, op }, () => callback());
}
