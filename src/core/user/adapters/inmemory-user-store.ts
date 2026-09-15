/**
 * In-Memory User Store Adapter
 *
 * Development-only implementation.
 * Uses real password hashing (bcryptjs) even in dev.
 * Data is lost on server restart — not for production.
 *
 * Production requires a database-backed adapter.
 */

import { UserStore } from '../user-store.port';
import { UserRecord, CreateUserInput } from '../user.types';
import { hashPassword, verifyPassword } from '../services/password-hashing.service';
import { normalizeEmail } from '../utils/email.util';

/**
 * Development in-memory user store.
 * Uses Map<email, UserRecord> for O(1) lookups.
 */
export class InMemoryUserStore implements UserStore {
  // Map: normalized email → user record
  private readonly users = new Map<string, UserRecord>();
  // Map: user ID → user record (for findById)
  private readonly usersById = new Map<string, UserRecord>();
  // Counter for generating user IDs
  private nextUserId = 1;

  constructor() {
    this.seedDemoUser();
  }

  /**
   * Seed demo users for testing.
   *
   * User Credentials:
   * - Email: demo@faded.test | Password: Password123! | Role: customer
   * - Email: admin@faded.test | Password: Admin123! | Role: admin
   */
  private async seedDemoUser(): Promise<void> {
    // Regular customer user
    const customerEmail = normalizeEmail('demo@faded.test');
    const customerPasswordHash = await hashPassword('Password123!');

    const customerUser: UserRecord = {
      id: 'user-demo',
      email: customerEmail,
      passwordHash: customerPasswordHash,
      firstName: 'Demo',
      lastName: 'User',
      marketingOptIn: false,
      emailVerified: true,
      roles: ['customer'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(customerEmail, customerUser);
    this.usersById.set(customerUser.id, customerUser);

    // Admin user
    const adminEmail = normalizeEmail('admin@faded.test');
    const adminPasswordHash = await hashPassword('Admin123!');

    const adminUser: UserRecord = {
      id: 'user-admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      marketingOptIn: false,
      emailVerified: true,
      roles: ['admin'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(adminEmail, adminUser);
    this.usersById.set(adminUser.id, adminUser);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = normalizeEmail(email);
    return this.users.get(normalized) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  async create(input: CreateUserInput, passwordHash: string): Promise<UserRecord> {
    const email = normalizeEmail(input.email);

    // Check if email already exists
    if (this.users.has(email)) {
      throw new Error(`Email ${input.email} already registered`);
    }

    // Create new user
    const user: UserRecord = {
      id: `user-${this.nextUserId++}`,
      email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      marketingOptIn: input.marketingOptIn,
      emailVerified: false, // New users start unverified
      roles: ['customer'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store by email and ID
    this.users.set(email, user);
    this.usersById.set(user.id, user);

    return user;
  }

  async verifyPassword(user: UserRecord, plaintext: string): Promise<boolean> {
    return verifyPassword(plaintext, user.passwordHash);
  }

  async markEmailVerified(userId: string): Promise<UserRecord> {
    const user = this.usersById.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Create updated user record
    const updated: UserRecord = {
      ...user,
      emailVerified: true,
      updatedAt: new Date(),
    };

    // Update both maps
    this.usersById.set(userId, updated);
    this.users.set(user.email, updated);

    return updated;
  }

  async emailExists(email: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    return this.users.has(normalized);
  }
}
