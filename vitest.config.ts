/**
 * Vitest Configuration
 * Test runner configuration for integration tests
 *
 * Phase 3C: Integration Tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load test environment variables early
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['src/__tests__/setup.ts'],
    threads: false,
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.test.ts',
        '**/setup.ts',
        '**/helpers.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
