/**
 * PostgreSQL User Store Adapter
 *
 * Replaces InMemoryUserStore, which was explicitly marked development-only and
 * lost every account on restart. That was tolerable while the only accounts
 * were two hardcoded demo users; it is not once staff can be invited, since an
 * invited colleague would silently cease to exist at the next deploy.
 *
 * Satisfies the same UserStore port, so the auth endpoints are unchanged — the
 * port existed precisely to allow this swap.
 *
 * IDENTITY CONTINUITY (important)
 * audit_logs.actor_id references staff user ids. The seeded demo accounts keep
 * the exact uuids they had in the in-memory store, because dozens of existing
 * audit rows point at them; issuing new ids would render that history
 * unattributable — the very failure this system spends its effort preventing.
 */

import { UserStore } from '../user-store.port';
import { UserRecord, CreateUserInput } from '../user.types';
import { hashPassword, verifyPassword } from '../services/password-hashing.service';
import { normalizeEmail } from '../utils/email.util';
import { getDataSource } from '../../database/postgres-data-source';
import { randomUUID } from 'node:crypto';

/** Uuids the seeded accounts have always had. Do not change these. */
const SEEDED = {
  admin: '550e8400-e29b-41d4-a716-4466554400a1',
  customer: '550e8400-e29b-41d4-a716-4466554400d1',
} as const;

interface StaffRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  status: string;
  email_verified: boolean;
  marketing_opt_in: boolean;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: StaffRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    marketingOptIn: Boolean(row.marketing_opt_in),
    emailVerified: Boolean(row.email_verified),
    roles: Array.isArray(row.roles) ? row.roles : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresUserStore implements UserStore {
  private get manager() {
    return getDataSource().manager;
  }

  /**
   * Seed the demo accounts if absent.
   * Idempotent: an existing row is left untouched, so a changed password or
   * role assigned through the console survives a restart.
   */
  async ensureSeeded(): Promise<void> {
    const [existing] = await this.manager.query(
      `SELECT COUNT(*)::int AS n FROM staff_users`,
    );
    if (Number(existing?.n ?? 0) > 0) return;

    const accounts: Array<[string, string, string, string, string, string[]]> = [
      [SEEDED.admin, 'admin@faded.test', 'Admin123!', 'Admin', 'User', ['admin']],
      [SEEDED.customer, 'demo@faded.test', 'Password123!', 'Demo', 'User', ['customer']],
    ];

    for (const [id, email, password, first, last, roles] of accounts) {
      const hash = await hashPassword(password);
      await this.manager.query(
        `INSERT INTO staff_users
           (id, email, email_normalized, password_hash, first_name, last_name,
            roles, status, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',true)
         ON CONFLICT (email_normalized) DO NOTHING`,
        [id, email, normalizeEmail(email), hash, first, last, JSON.stringify(roles)],
      );
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.manager.query(
      // Deactivated accounts are not returned, so a retired colleague cannot
      // authenticate even with a valid password.
      `SELECT * FROM staff_users WHERE email_normalized = $1 AND status = 'active'`,
      [normalizeEmail(email)],
    );
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [row] = await this.manager.query(`SELECT * FROM staff_users WHERE id = $1`, [id]);
    return row ? toRecord(row) : null;
  }

  async create(input: CreateUserInput, passwordHash: string): Promise<UserRecord> {
    const email = normalizeEmail(input.email);
    if (await this.emailExists(email)) {
      throw new Error(`Email ${input.email} already registered`);
    }

    const [row] = await this.manager.query(
      `INSERT INTO staff_users
         (id, email, email_normalized, password_hash, first_name, last_name,
          roles, status, email_verified, marketing_opt_in)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',false,$8)
       RETURNING *`,
      [
        randomUUID(),
        input.email,
        email,
        passwordHash,
        input.firstName?.trim() || null,
        input.lastName?.trim() || null,
        // Self-service signup never grants staff access. Roles are assigned
        // deliberately through the staff console.
        JSON.stringify(['customer']),
        input.marketingOptIn ?? false,
      ],
    );
    return toRecord(row);
  }

  async verifyPassword(user: UserRecord, plaintext: string): Promise<boolean> {
    return verifyPassword(plaintext, user.passwordHash);
  }

  async markEmailVerified(userId: string): Promise<UserRecord> {
    const [row] = await this.manager.query(
      `UPDATE staff_users SET email_verified = true, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [userId],
    );
    if (!row) throw new Error(`User ${userId} not found`);
    return toRecord(row);
  }

  async emailExists(email: string): Promise<boolean> {
    const [row] = await this.manager.query(
      `SELECT 1 AS found FROM staff_users WHERE email_normalized = $1`,
      [normalizeEmail(email)],
    );
    return Boolean(row);
  }

  /** Records a successful sign-in, for the staff console's last-seen column. */
  async touchLastLogin(userId: string): Promise<void> {
    await this.manager.query(
      `UPDATE staff_users SET last_login_at = now() WHERE id = $1`,
      [userId],
    );
  }
}
