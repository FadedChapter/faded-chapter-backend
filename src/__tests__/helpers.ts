/**
 * Test Helpers
 * Utility functions for testing
 *
 * Phase 3C: Integration Tests
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { CustomerService } from '../core/services/customer.service.js';
import { AuthService } from '../core/services/auth.service.js';
import { SessionService } from '../core/services/session.service.js';
import { generateToken } from '../core/utils/jwt.util.js';

/**
 * Test user credentials
 */
export const testUser = {
  email: 'testuser@example.com',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
};

/**
 * Alternative test user
 */
export const testUser2 = {
  email: 'testuser2@example.com',
  password: 'TestPassword456!',
  firstName: 'Another',
  lastName: 'User',
};

/**
 * Generate test JWT token
 */
export function generateTestJWT(customerId: string, storeId: string, sessionId: string = uuidv4()): string {
  return generateToken(customerId, storeId, sessionId);
}

/**
 * Hash password for testing
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Create mock request headers
 */
export function createHeaders(options: { jwt?: string; storeId?: string } = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.jwt) {
    headers['Authorization'] = `Bearer ${options.jwt}`;
  }

  if (options.storeId) {
    headers['X-Store-ID'] = options.storeId;
  }

  return headers;
}

/**
 * Create test address
 */
export function createTestAddress(overrides: Partial<any> = {}): any {
  return {
    firstName: 'John',
    lastName: 'Doe',
    phone: '+14155552671',
    addressLine1: '123 Main St',
    addressLine2: 'Suite 100',
    city: 'San Francisco',
    stateProvince: 'CA',
    postalCode: '94105',
    countryCode: 'US',
    type: 'shipping',
    ...overrides,
  };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract JWT from response
 */
export function extractJWT(body: any): string {
  if (body && body.token) {
    return body.token;
  }
  throw new Error('No JWT token found in response');
}

/**
 * Assert error response format
 */
export function assertErrorResponse(body: any): void {
  if (!body.error || !body.message || !body.statusCode) {
    throw new Error('Response does not match error format');
  }
}

/**
 * Check if email is normalized
 */
export function isEmailNormalized(email: string): boolean {
  return email === email.toLowerCase().trim();
}

/**
 * UUID validation
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Timestamp validation
 */
export function isValidISO8601(timestamp: string): boolean {
  return !isNaN(Date.parse(timestamp));
}

export default {
  testUser,
  testUser2,
  generateTestJWT,
  hashPassword,
  createHeaders,
  createTestAddress,
  sleep,
  extractJWT,
  assertErrorResponse,
  isEmailNormalized,
  isValidUUID,
  isValidISO8601,
};
