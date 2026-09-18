/**
 * Admin Staff Controller
 *
 * Phase 11: Settings — Staff & Roles.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission).
 *
 * This module governs who can use every other module, so its failure modes are
 * different in kind. The guards below exist to prevent an administrator
 * destroying their own or the organisation's access — mistakes that cannot be
 * undone from inside the product.
 */

import { Request, Response } from 'express';
import { getDataSource } from '../database/postgres-data-source';
import { hashPassword } from '../user/services/password-hashing.service';
import { normalizeEmail } from '../user/utils/email.util';
import { ROLE_PERMISSIONS } from '../middleware/authorization.middleware';
import { logError, logInfo } from '../logging/logger';
import { randomUUID } from 'node:crypto';

/** Roles assignable through this console. */
const ASSIGNABLE_ROLES = ['admin', 'support', 'customer'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * `system` is deliberately not assignable.
 *
 * It carries store.access-all, which crosses store boundaries, and exists for
 * internal and batch processes rather than people. Granting it through a UI
 * would make a human able to operate outside the store scoping every other
 * check depends on.
 */
const NON_ASSIGNABLE = ['system'];

const MIN_PASSWORD_LENGTH = 12;

function toStaffDTO(row: {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  status: string;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  /**
   * Queried on every path that builds this DTO, not just the list.
   *
   * It was list-only at first, which made `canDelete` come back false on the
   * response to a create or a status change — the same account the list called
   * deletable a second later. A field that contradicts itself between two
   * responses is worse than one that is simply absent.
   */
  audit_events: number;
}) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    email: row.email,
    name: name.length > 0 ? name : null,
    roles: Array.isArray(row.roles) ? row.roles : [],
    status: row.status,
    emailVerified: Boolean(row.email_verified),
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    /*
     * How many recorded actions this account is responsible for, and whether
     * it can therefore be erased rather than merely retired.
     *
     * Sent so the console can offer the honest action instead of presenting a
     * delete button that the server will refuse. The server re-counts on the
     * delete itself, so a row that goes stale between the two costs a 409, not
     * an orphaned audit trail.
     */
    auditEvents: row.audit_events,
    canDelete: row.audit_events === 0,
    // password_hash is never mapped. There is no admin task that needs it, and
    // its presence in a response is a credential-theft surface.
  };
}

export class AdminStaffController {
  private get manager() {
    return getDataSource().manager;
  }

  /** GET /staff — everyone with an account, and the role catalogue. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      /*
       * auditEvents decides whether an account can be erased or only retired.
       *
       * An account that has done something is the answer to "who approved this
       * refund" — deleting the row would leave 61 audit entries pointing at an
       * id that resolves to nobody. One that has never acted carries no such
       * meaning and is safe to remove outright, which covers the common case
       * of an invitation sent to the wrong address.
       */
      const rows = await this.manager.query(
        `SELECT s.id, s.email, s.first_name, s.last_name, s.roles, s.status,
                s.email_verified, s.last_login_at, s.created_at,
                (SELECT COUNT(*)::int FROM audit_logs a WHERE a.actor_id = s.id) AS audit_events
         FROM staff_users s
         ORDER BY s.created_at ASC`,
      );

      // The catalogue is derived from ROLE_PERMISSIONS rather than restated, so
      // the console cannot drift from what the server actually enforces.
      const roles = ASSIGNABLE_ROLES.map((role) => ({
        role,
        permissions: ROLE_PERMISSIONS[role] ?? [],
        permissionCount: (ROLE_PERMISSIONS[role] ?? []).length,
      }));

      res.status(200).json({
        success: true,
        data: {
          staff: rows.map(toStaffDTO),
          roles,
          /** So the UI can mark the signed-in row and disable self-destructive actions. */
          currentUserId: req.auth?.userId ?? null,
        },
      });
    } catch (error) {
      logError('admin_staff_list_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load staff' });
    }
  }

  /** POST /staff — create an account with a role. */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body ?? {};
      const email = String(body.email ?? '').trim();
      const password = String(body.password ?? '');
      const role = body.role as AssignableRole;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ success: false, error: 'A valid email address is required' });
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        // Staff credentials unlock the whole console; the bar is higher than
        // for a shopper account.
        res.status(400).json({
          success: false,
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        });
        return;
      }
      if (NON_ASSIGNABLE.includes(role)) {
        res.status(403).json({
          success: false,
          error: `The ${role} role cannot be assigned to a person — it operates across store boundaries`,
        });
        return;
      }
      if (!ASSIGNABLE_ROLES.includes(role)) {
        res.status(400).json({
          success: false,
          error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`,
        });
        return;
      }

      const normalized = normalizeEmail(email);
      const [existing] = await this.manager.query(
        `SELECT 1 AS found FROM staff_users WHERE email_normalized = $1`,
        [normalized],
      );
      if (existing) {
        res.status(409).json({ success: false, error: 'That email already has an account' });
        return;
      }

      const id = randomUUID();
      const hash = await hashPassword(password);
      const [row] = await this.manager.query(
        `INSERT INTO staff_users
           (id, email, email_normalized, password_hash, first_name, last_name,
            roles, status, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',false)
         RETURNING id, email, first_name, last_name, roles, status, email_verified,
                   last_login_at, created_at,
                   -- Always 0 for a row created a moment ago, but read rather
                   -- than assumed so every response carries the same shape.
                   (SELECT COUNT(*)::int FROM audit_logs WHERE actor_id = $1)
                     AS audit_events`,
        [
          id,
          email,
          normalized,
          hash,
          typeof body.firstName === 'string' ? body.firstName.trim() || null : null,
          typeof body.lastName === 'string' ? body.lastName.trim() || null : null,
          JSON.stringify([role]),
        ],
      );

      res.locals['auditRecordId'] = id;

      // The password is never logged, here or anywhere.
      logInfo('staff_account_created', {
        staffId: id,
        email,
        role,
        actorId: req.auth?.userId ?? null,
        actorEmail: req.auth?.email ?? null,
      });

      res.status(201).json({ success: true, data: toStaffDTO(row) });
    } catch (error) {
      logError('admin_staff_create_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to create the account' });
    }
  }

  /** POST /staff/:staffId/role */
  async setRole(req: Request, res: Response): Promise<void> {
    try {
      const { staffId } = req.params;
      const role = req.body?.role as AssignableRole;
      const actorId = req.auth?.userId;

      if (NON_ASSIGNABLE.includes(role)) {
        res.status(403).json({
          success: false,
          error: `The ${role} role cannot be assigned to a person`,
        });
        return;
      }
      if (!ASSIGNABLE_ROLES.includes(role)) {
        res.status(400).json({
          success: false,
          error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`,
        });
        return;
      }

      const [target] = await this.manager.query(
        `SELECT id, roles, status FROM staff_users WHERE id = $1`,
        [staffId],
      );
      if (!target) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }

      const wasAdmin = (target.roles ?? []).includes('admin');

      // Guard 1: do not let an administrator demote themselves. They would lose
      // access to this console on their next request and could not undo it.
      if (staffId === actorId && wasAdmin && role !== 'admin') {
        res.status(409).json({
          success: false,
          error:
            'You cannot remove your own administrator access. Ask another administrator to do it.',
        });
        return;
      }

      // Guard 2: never remove the last administrator. An organisation with no
      // admin cannot appoint one — the recovery path is outside the product.
      if (wasAdmin && role !== 'admin' && (await this.countActiveAdmins()) <= 1) {
        res.status(409).json({
          success: false,
          error: 'This is the only administrator. Appoint another before changing this one.',
        });
        return;
      }

      await this.manager.query(
        `UPDATE staff_users SET roles = $1, updated_at = now() WHERE id = $2`,
        [JSON.stringify([role]), staffId],
      );

      res.locals['auditRecordId'] = staffId;
      logInfo('staff_role_changed', {
        staffId,
        from: target.roles,
        to: [role],
        actorId: actorId ?? null,
        actorEmail: req.auth?.email ?? null,
      });

      const [row] = await this.manager.query(
        `SELECT id, email, first_name, last_name, roles, status, email_verified,
                last_login_at, created_at,
                (SELECT COUNT(*)::int FROM audit_logs WHERE actor_id = staff_users.id)
                  AS audit_events
           FROM staff_users WHERE id = $1`,
        [staffId],
      );
      res.status(200).json({ success: true, data: toStaffDTO(row) });
    } catch (error) {
      logError('admin_staff_role_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to change the role' });
    }
  }

  /** POST /staff/:staffId/status — activate or deactivate. */
  /**
   * DELETE /:staffId — erase an account that never did anything.
   *
   * Deliberately narrow. Retiring a colleague is a status change: it revokes
   * access immediately (findByEmail only returns active accounts, so a valid
   * password stops working the moment they are deactivated) while keeping the
   * record that makes past actions attributable.
   *
   * Erasure is offered only where there is nothing to attribute — no audit
   * history at all. An invitation to a mistyped address, an account created
   * twice. Anything else is refused with the reason, rather than quietly
   * leaving audit rows pointing at an id that resolves to nobody.
   *
   * There is no foreign key from audit_logs.actor_id to enforce this, so the
   * check has to be made here.
   */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      const { staffId } = req.params;
      const actorId = req.auth?.userId;

      const [target] = await this.manager.query(
        `SELECT id, email, roles, status FROM staff_users WHERE id = $1`,
        [staffId],
      );
      if (!target) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }

      // The same two guards every destructive staff action carries.
      if (staffId === actorId) {
        res.status(409).json({ success: false, error: 'You cannot delete your own account.' });
        return;
      }
      if ((target.roles ?? []).includes('admin') && (await this.countActiveAdmins()) <= 1) {
        res.status(409).json({
          success: false,
          error: 'This is the only active administrator and cannot be deleted.',
        });
        return;
      }

      const [{ count }] = await this.manager.query(
        `SELECT COUNT(*)::int AS count FROM audit_logs WHERE actor_id = $1`,
        [staffId],
      );
      if (count > 0) {
        res.status(409).json({
          success: false,
          error:
            `This account has ${count} recorded ${count === 1 ? 'action' : 'actions'} and cannot be deleted — ` +
            'the audit trail would no longer say who performed them. Remove them from the team instead, ' +
            'which revokes access immediately and keeps the history intact.',
        });
        return;
      }

      await this.manager.query(`DELETE FROM staff_users WHERE id = $1`, [staffId]);

      res.locals['auditRecordId'] = staffId;
      logInfo('staff_deleted', { staffId, email: target.email, actorId: actorId ?? null });

      res.status(200).json({ success: true, data: { id: staffId } });
    } catch (error) {
      logError('admin_staff_delete_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to delete the account' });
    }
  }

  async setStatus(req: Request, res: Response): Promise<void> {
    try {
      const { staffId } = req.params;
      const status = req.body?.status;
      const actorId = req.auth?.userId;

      if (status !== 'active' && status !== 'inactive') {
        res.status(400).json({ success: false, error: "status must be 'active' or 'inactive'" });
        return;
      }

      const [target] = await this.manager.query(
        `SELECT id, roles, status FROM staff_users WHERE id = $1`,
        [staffId],
      );
      if (!target) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }
      if (target.status === status) {
        res.status(409).json({ success: false, error: `Account is already ${status}` });
        return;
      }

      // Same two guards: locking yourself out, and removing the last admin.
      if (staffId === actorId && status === 'inactive') {
        res.status(409).json({
          success: false,
          error: 'You cannot deactivate your own account.',
        });
        return;
      }
      if (
        status === 'inactive' &&
        (target.roles ?? []).includes('admin') &&
        (await this.countActiveAdmins()) <= 1
      ) {
        res.status(409).json({
          success: false,
          error: 'This is the only active administrator and cannot be deactivated.',
        });
        return;
      }

      await this.manager.query(
        `UPDATE staff_users SET status = $1, updated_at = now() WHERE id = $2`,
        [status, staffId],
      );

      res.locals['auditRecordId'] = staffId;
      logInfo('staff_status_changed', {
        staffId,
        from: target.status,
        to: status,
        actorId: actorId ?? null,
      });

      const [row] = await this.manager.query(
        `SELECT id, email, first_name, last_name, roles, status, email_verified,
                last_login_at, created_at,
                (SELECT COUNT(*)::int FROM audit_logs WHERE actor_id = staff_users.id)
                  AS audit_events
           FROM staff_users WHERE id = $1`,
        [staffId],
      );
      res.status(200).json({ success: true, data: toStaffDTO(row) });
    } catch (error) {
      logError('admin_staff_status_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to change the status' });
    }
  }

  private async countActiveAdmins(): Promise<number> {
    const [row] = await this.manager.query(
      `SELECT COUNT(*)::int AS n FROM staff_users
       WHERE status = 'active' AND roles @> '["admin"]'::jsonb`,
    );
    return Number(row?.n ?? 0);
  }
}

export { ASSIGNABLE_ROLES, NON_ASSIGNABLE, MIN_PASSWORD_LENGTH };
