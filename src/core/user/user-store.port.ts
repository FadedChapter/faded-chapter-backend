/**
 * User Store Adapter (Port)
 *
 * Defines the contract for user persistence.
 * Implementation can be in-memory (dev), database-backed (production), etc.
 *
 * This is the boundary that allows future database migration without
 * changing authentication endpoints.
 */

import { CreateUserInput, UserRecord } from './user.types';

/**
 * Dependency injection symbol for the user store adapter.
 */
export const USER_STORE = Symbol('USER_STORE');

/**
 * User store port — all implementations must satisfy this contract.
 */
export interface UserStore {
  /**
   * Find a user by email (case-insensitive).
   * Returns null if not found.
   */
  findByEmail(email: string): Promise<UserRecord | null>;

  /**
   * Find a user by ID.
   * Returns null if not found.
   */
  findById(id: string): Promise<UserRecord | null>;

  /**
   * Create a new user.
   * Password must be hashed by the caller (not stored plaintext).
   * Returns the created user record.
   *
   * Throws if email already exists.
   */
  create(input: CreateUserInput, passwordHash: string): Promise<UserRecord>;

  /**
   * Verify a user's password.
   * Handles comparison of plaintext vs hash securely.
   *
   * Returns true if password matches, false otherwise.
   * NEVER reveals whether user exists or not (timing-safe).
   */
  verifyPassword(user: UserRecord, plaintext: string): Promise<boolean>;

  /**
   * Mark a user's email as verified.
   */
  markEmailVerified(userId: string): Promise<UserRecord>;

  /**
   * Check if an email is already registered.
   * Used during signup to prevent duplicates.
   */
  emailExists(email: string): Promise<boolean>;
}
