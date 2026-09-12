/**
 * Express Type Augmentation
 *
 * Extends Express Request type to include session data.
 * This is a valid use case for TypeScript namespace augmentation.
 */

import type { SessionRecord } from '../session.types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionRecord;
    }
  }
}

// This file is imported by session.middleware.ts to augment Express types
export {};
