/**
 * Vitest config — Phase 0 security-boundary tests.
 *
 * Deliberately separate from vitest.config.ts:
 *
 * The default config loads src/__tests__/setup.ts, whose global beforeAll
 * provisions and migrates a live Postgres test database. The authorization
 * tests are pure logic over signed tokens and must not depend on a database —
 * a security gate that can be skipped because infrastructure is unavailable is
 * not a gate.
 *
 * Run with: npm run test:security
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/security/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // No setupFiles: no database required.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
