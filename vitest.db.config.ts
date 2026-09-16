/**
 * Vitest config — database-backed tests.
 *
 * Separate from vitest.config.ts, which loads src/__tests__/setup.ts and that
 * insists on NODE_ENV=test plus a freshly migrated database. These tests run
 * against the configured DATABASE_URL as it stands, each one scoped to a
 * synthetic store id it creates and removes, so they can be run against a
 * development database without disturbing it.
 *
 * Kept out of the security suite deliberately: that one must stay database-free,
 * because a security gate that can be skipped when infrastructure is missing is
 * not a gate.
 *
 * Run with: npm run test:db
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/db/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // One process: these share a datasource and a synthetic store row.
    fileParallelism: false,
    // No setupFiles — the schema is expected to exist already.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
