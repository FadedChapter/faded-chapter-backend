/**
 * SQLite User Store (TypeORM Adapter)
 * Replaces InMemoryUserStore with persistent SQLite storage
 * Implements UserStore interface for ports-and-adapters pattern
 * Phase 3F.2: Database migration from in-memory store
 */

import { UserStore } from '../user-store.port';
import { UserRecord, CreateUserInput } from '../user.types';
import { UserEntity } from '../entities/user.entity';
import { AppDataSource } from '../../database/data-source';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../services/password-hashing.service';
import { normalizeEmail } from '../utils/email.util';

export class SqliteUserStore implements UserStore {
  private userRepository: Repository<UserEntity>;
  private nextUserId = 1;

  constructor() {
    this.userRepository = AppDataSource.getRepository(UserEntity);
    this.seedDemoUser();
  }

  /**
   * Seed a demo user for testing (matches InMemoryUserStore behavior)
   */
  private async seedDemoUser(): Promise<void> {
    try {
      const email = normalizeEmail('demo@faded.test');
      const existing = await this.findByEmail(email);

      if (!existing) {
        const passwordHash = await hashPassword('Password123!');
        const user: UserEntity = this.userRepository.create({
          id: 'user-demo',
          email,
          passwordHash,
          firstName: 'Demo',
          lastName: 'User',
          emailVerified: true,
          marketingOptIn: false,
        });

        await this.userRepository.save(user);
        console.log('[SqliteUserStore] ✅ Demo user seeded');
      }
    } catch (error) {
      console.error('[SqliteUserStore] ⚠️ Error seeding demo user:', error);
    }
  }

  /**
   * Find user by email (case-insensitive)
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    try {
      const normalized = normalizeEmail(email);
      const entity = await this.userRepository.findOne({
        where: { email: normalized },
      });
      return entity ? this.entityToRecord(entity) : null;
    } catch (error) {
      console.error('[SqliteUserStore] ❌ Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserRecord | null> {
    try {
      const entity = await this.userRepository.findOne({ where: { id } });
      return entity ? this.entityToRecord(entity) : null;
    } catch (error) {
      console.error('[SqliteUserStore] ❌ Error finding user by ID:', error);
      return null;
    }
  }

  /**
   * Create a new user
   */
  async create(input: CreateUserInput, passwordHash: string): Promise<UserRecord> {
    try {
      const email = normalizeEmail(input.email);

      // Check if email already exists
      const existing = await this.findByEmail(email);
      if (existing) {
        throw new Error(`Email ${input.email} already registered`);
      }

      // Generate new user ID
      const newId = `user-${this.nextUserId++}`;

      const user = this.userRepository.create({
        id: newId,
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        emailVerified: false,
        marketingOptIn: input.marketingOptIn,
      });

      const saved = await this.userRepository.save(user);
      return this.entityToRecord(saved);
    } catch (error) {
      console.error('[SqliteUserStore] ❌ Error creating user:', error);
      throw error;
    }
  }

  /**
   * Verify a user's password
   */
  async verifyPassword(user: UserRecord, plaintext: string): Promise<boolean> {
    try {
      return await verifyPassword(plaintext, user.passwordHash);
    } catch (error) {
      console.error('[SqliteUserStore] ❌ Error verifying password:', error);
      return false;
    }
  }

  /**
   * Mark a user's email as verified
   */
  async markEmailVerified(userId: string): Promise<UserRecord> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      await this.userRepository.update(userId, {
        emailVerified: true,
      });

      const updated = await this.findById(userId);
      if (!updated) throw new Error(`User ${userId} not found after update`);
      return updated;
    } catch (error) {
      console.error('[SqliteUserStore] ❌ Error marking email verified:', error);
      throw error;
    }
  }

  /**
   * Check if an email is already registered
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const normalized = normalizeEmail(email);
      const count = await this.userRepository.count({
        where: { email: normalized },
      });
      return count > 0;
    } catch (error) {
      console.error('[SqliteUserStore] ❌ Error checking if email exists:', error);
      return false;
    }
  }

  /**
   * No-op.
   *
   * `UserEntity` has no last-login column — last-seen lives on the Postgres
   * `staff_users` table and is read straight out of it by the staff console,
   * which never runs against this store. Adding a column here would create a
   * second place to keep in step for a value nothing in this path reads.
   */
  async touchLastLogin(_userId: string): Promise<void> {
    // Intentionally empty — see above.
  }

  /**
   * Convert TypeORM entity to UserRecord
   */
  private entityToRecord(entity: UserEntity): UserRecord {
    return {
      id: entity.id,
      email: entity.email,
      passwordHash: entity.passwordHash,
      firstName: entity.firstName,
      lastName: entity.lastName,
      emailVerified: entity.emailVerified,
      marketingOptIn: entity.marketingOptIn ?? false,
      roles: ['customer'],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
