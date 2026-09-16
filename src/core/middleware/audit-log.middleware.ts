/**
 * Admin Audit Logging Middleware
 *
 * Phase 0: Security boundary.
 *
 * Records administrative mutations to the append-only audit_logs table.
 *
 * TIMING NOTE (deliberate, please read before changing):
 * The record is written when the response finishes, so that the recorded
 * outcome reflects what actually happened. That means auditing cannot be
 * strictly "fail-closed" — by the time we know the result, the mutation has
 * already been applied. Writing the record *before* the handler would instead
 * log actions that never occurred, which is worse for an audit trail.
 *
 * Consequently a persistence failure is surfaced as an `error`-level log with a
 * stable `audit_persist_failed` marker. That marker is intended to be alerted
 * on: a silent gap in the admin audit trail is a compliance incident, not a
 * routine warning.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { logInfo, logWarn, logError } from '../logging/logger';
import { getDataSource } from '../database/postgres-data-source';
import { AuditLogEntity } from '../entities/index';

/** Methods treated as mutations for audit purposes. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Best-effort extraction of the resource id this mutation targeted.
 * audit_logs.record_id is a non-null uuid, so a non-uuid id cannot be stored
 * there; such actions are still logged to the structured logger.
 */
function resolveRecordId(req: Request, res: Response): string | null {
  // A create has no record id in its route params — the id is generated inside
  // the handler — so handlers publish it on res.locals and it is preferred
  // here. Without this, every create operation in the console audited nothing
  // at all, which for discounts meant minting spendable value left no trace.
  const published = (res.locals as { auditRecordId?: unknown }).auditRecordId;
  if (typeof published === 'string' && UUID_PATTERN.test(published)) {
    return published;
  }

  // Otherwise any uuid-shaped route param identifies the record, excluding
  // storeId which is the scope rather than the subject.
  //
  // This was previously a hardcoded list of param names (orderId, productId,
  // …). Every new module had to remember to add its own, and Phase 4's
  // :variantId was missed — so inventory adjustments produced no audit rows at
  // all. Silence in an audit trail is the worst failure mode available, so the
  // rule is now structural rather than a list someone must maintain.
  for (const [name, value] of Object.entries(req.params)) {
    if (name === 'storeId') continue;
    if (typeof value === 'string' && UUID_PATTERN.test(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Audit an administrative action.
 *
 * @param action Stable action name, e.g. 'refund.approve'. Used as the audit
 *               action and as the log marker — keep it stable across releases.
 * @param tableName Logical resource the action targets, e.g. 'refunds'.
 */
export function auditLog(action: string, tableName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    res.on('finish', () => {
      const succeeded = res.statusCode >= 200 && res.statusCode < 400;
      const actor = req.auth;

      const context = {
        action,
        table: tableName,
        actorId: actor?.userId ?? null,
        actorEmail: actor?.email ?? null,
        actorRole: actor?.role ?? null,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        outcome: succeeded ? 'success' : 'failure',
        ip: req.ip ?? null,
      };

      // Always emit to the structured log, including denied attempts.
      logInfo('admin_action', context);

      // Denied/failed attempts are recorded in logs but not written to the
      // row-level audit table, which describes committed record changes.
      if (!succeeded) {
        return;
      }

      const recordId = resolveRecordId(req, res);
      if (!recordId) {
        logWarn('admin_action_no_record_id', context);
        return;
      }

      void persistAuditRecord({
        action,
        tableName,
        recordId,
        // The scope of the change. The audit endpoint is store-scoped, so
        // without this the query could not honour the store it was asked for.
        // Falls back to the token's binding when the route carries no :storeId
        // (the staff module is platform-level rather than per-store).
        storeId: req.params['storeId'] ?? actor?.storeId ?? null,
        // actor_id is a uuid column. A non-uuid actor id is recorded as null
        // rather than thrown away with the whole record — the actor's identity
        // is still preserved in the structured log above.
        actorId: actor?.userId && UUID_PATTERN.test(actor.userId) ? actor.userId : null,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        context,
      });
    });

    next();
  };
}

async function persistAuditRecord(input: {
  action: string;
  tableName: string;
  recordId: string;
  storeId: string | null;
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  context: Record<string, unknown>;
}): Promise<void> {
  try {
    const dataSource = getDataSource();
    if (!dataSource.isInitialized) {
      logError('audit_persist_failed', undefined, {
        ...input.context,
        reason: 'datasource_not_initialized',
      });
      return;
    }

    const repository = dataSource.getRepository(AuditLogEntity);
    await repository.insert({
      id: randomUUID(),
      store_id: input.storeId,
      table_name: input.tableName,
      record_id: input.recordId,
      actor_id: input.actorId,
      actor_type: 'staff',
      action: input.action,
      changes: null,
      ip_address: input.ip,
      user_agent: typeof input.userAgent === 'string' ? input.userAgent : null,
    });
  } catch (error) {
    // A gap in the admin audit trail is a compliance incident. Alert on this marker.
    logError('audit_persist_failed', error instanceof Error ? error : undefined, {
      ...input.context,
    });
  }
}
