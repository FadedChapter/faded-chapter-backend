/**
 * Session Module
 *
 * Public API for session management.
 * Exposes types, ports, and middleware for Express integration.
 */

// Domain types
export type { SessionId, CustomerId, SessionRecord, SessionConfig } from './session.types';
export { DEFAULT_SESSION_CONFIG, createSessionId, createCustomerId } from './session.types';

// Ports (interfaces for implementations)
export type { SessionStore } from './session-store.port';
export { SESSION_STORE } from './session-store.port';

// Middleware
export {
  createSessionMiddleware,
  requireSession,
  setSessionCookie,
  clearSessionCookie,
} from './middleware/session.middleware';

// Development adapter (NOT for production)
export { InMemorySessionStore } from './adapters/inmemory-session-store';
