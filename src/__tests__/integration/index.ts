/**
 * Integration Tests
 * Complete test suite for all API functionality
 *
 * Phase 3C: Integration Tests
 */

export * from './auth-flow.test.js';
export * from './store-isolation.test.js';
export * from './security.test.js';
export * from './soft-delete.test.js';

/**
 * Test Execution Guide
 *
 * Run all tests:
 *   npm test
 *
 * Run specific suite:
 *   npm test -- auth-flow.test.ts
 *
 * Run with coverage:
 *   npm test -- --coverage
 *
 * Watch mode:
 *   npm test -- --watch
 *
 * UI dashboard:
 *   npm test -- --ui
 */
