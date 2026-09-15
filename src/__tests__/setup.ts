/**
 * Test Setup
 * Global test configuration and utilities
 *
 * Phase 3C: Integration Tests
 */

import { describe, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeDatabase, closeDatabase, runMigrations, getDataSource } from '../core/database/postgres-data-source.js';
import { env } from '../core/config/env.js';

/**
 * Database setup for tests
 * Runs migrations before tests and cleans up after
 */
export async function setupTestDatabase(): Promise<void> {
  // Ensure we're in test mode
  if (!env.get('NODE_ENV')?.includes('test')) {
    throw new Error('NODE_ENV must be set to "test"');
  }

  try {
    await initializeDatabase();
    await runMigrations();
    console.log('✅ Test database initialized');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Clean up database after tests
 */
export async function teardownTestDatabase(): Promise<void> {
  try {
    const dataSource = getDataSource();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('✅ Test database closed');
    }
  } catch (error) {
    console.error('❌ Failed to teardown test database:', error);
  }
}

/**
 * Clear all data from tables (for test isolation)
 */
export async function clearDatabase(): Promise<void> {
  const dataSource = getDataSource();
  if (!dataSource.isInitialized) {
    throw new Error('Database not initialized');
  }

  const tables = [
    'sessions',
    'verification_tokens',
    'password_reset_tokens',
    'customer_consent',
    'customer_addresses',
    'customer_preferences',
    'customer_credentials',
    'customers',
    'store_settings',
    'audit_logs',
    'stores',
  ];

  for (const table of tables) {
    await dataSource.query(`TRUNCATE TABLE ${table} CASCADE`);
  }

  console.log('✅ Database cleared');
}

/**
 * Create test store
 */
export async function createTestStore(): Promise<string> {
  const dataSource = getDataSource();
  const result = await dataSource.query(
    `
    INSERT INTO stores (id, name, slug, domain, owner_email, owner_name, status)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    ['Test Store', 'test-store', 'test.example.com', 'owner@test.com', 'Test Owner', 'active']
  );

  return result[0].id;
}

/**
 * Create test customer
 */
export async function createTestCustomer(
  storeId: string,
  email: string = 'test@example.com'
): Promise<{ id: string; email: string }> {
  const dataSource = getDataSource();
  const result = await dataSource.query(
    `
    INSERT INTO customers (id, store_id, email, email_normalized, status, email_verified)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
    RETURNING id, email
    `,
    [storeId, email, email.toLowerCase(), 'active', false]
  );

  return result[0];
}

/**
 * Create test credentials (password)
 */
export async function createTestCredentials(
  customerId: string,
  storeId: string,
  passwordHash: string
): Promise<void> {
  const dataSource = getDataSource();
  await dataSource.query(
    `
    INSERT INTO customer_credentials (id, customer_id, store_id, password_hash, hash_algorithm, hash_version, is_active)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
    `,
    [customerId, storeId, passwordHash, 'bcrypt', 1, true]
  );
}

/**
 * Global test hooks
 */
beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
});

export default { setupTestDatabase, teardownTestDatabase, clearDatabase, createTestStore, createTestCustomer, createTestCredentials };
