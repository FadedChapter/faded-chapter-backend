/**
 * Password Hashing Service
 *
 * Encapsulates bcryptjs password hashing/verification.
 * Never expose plaintext passwords or raw hashes to the browser.
 *
 * Key principles:
 * - Always use bcrypt for hashing (never plaintext)
 * - Salt rounds = 10 (reasonable security vs performance trade-off)
 * - Use timing-safe comparisons (bcrypt handles this)
 * - Never log passwords or hashes
 */

import * as bcrypt from 'bcryptjs';

/**
 * Hashing configuration.
 */
const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password using bcrypt.
 * Called during signup.
 *
 * @param plaintext - User's plaintext password
 * @returns Promise resolving to bcrypt hash
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('Password cannot be empty');
  }

  try {
    const hash = await bcrypt.hash(plaintext, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('[PasswordHashing] Hash failed:', error instanceof Error ? error.message : error);
    const err = new Error('Password hashing failed');
    // @ts-ignore cause property not in TS lib yet
    err.cause = error;
    throw err;
  }
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * Called during login.
 *
 * Timing-safe comparison is handled by bcrypt internally.
 *
 * @param plaintext - User's submitted plaintext password
 * @param hash - Stored bcrypt hash
 * @returns Promise resolving to true if matches, false otherwise
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!plaintext || !hash) {
    return false;
  }

  try {
    const matches = await bcrypt.compare(plaintext, hash);
    return matches;
  } catch (error) {
    console.error('[PasswordHashing] Verify failed:', error instanceof Error ? error.message : error);
    // Treat errors as verification failure (don't expose details)
    return false;
  }
}
