/**
 * User Domain Model
 *
 * Local authenticated user identity for Phase 3F.2.
 * Does NOT map to Shopify customer ID yet — that's Phase 3F.3.
 *
 * This is the user identity that exists on our server, separate from
 * Shopify's customer system. The mapping happens in Phase 3F.3.
 */

/**
 * Server-side user record.
 * Contains password hash (never exposed to browser).
 */
export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string; // bcrypt hash, never plaintext
  readonly firstName?: string;
  readonly lastName?: string;
  readonly marketingOptIn: boolean;
  readonly emailVerified: boolean;
  readonly roles: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Authenticated user (sent to client).
 * Contains only what the UI needs, no sensitive data.
 */
export interface AuthenticatedUserData {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly marketingOptIn: boolean;
  readonly emailVerified: boolean;
}

/**
 * User creation input (from signup endpoint).
 */
export interface CreateUserInput {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly marketingOptIn: boolean;
}

// Placeholder: Additional user types can be defined here as needed in Phase 3F.3+
