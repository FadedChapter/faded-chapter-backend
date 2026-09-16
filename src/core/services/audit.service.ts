/**
 * Audit Service
 *
 * Reads the administrative audit trail.
 *
 * This file previously described a second, parallel audit system writing to and
 * reading from `audit_logs_payment` — a table that exists in no migration and
 * in no database. Its four write methods had no callers, so nothing was ever
 * lost; its two read methods were wrapped in try/catch and returned [] on the
 * "relation does not exist" error, which is why the dashboard's admin-actions
 * panel showed nothing and never reported a problem.
 *
 * The real trail is `audit_logs`, written by audit-log.middleware on every
 * successful admin mutation. This service now reads that.
 *
 * The write methods are gone rather than repointed. The middleware is the
 * writer — it is mounted on every admin route and already records actor,
 * action, target and outcome — and a second writer that silently swallowed
 * everything is precisely the failure being fixed here.
 */

import { getDataSource } from '../database/postgres-data-source';
import { logError } from '../logging/logger';

/**
 * A recorded administrative action.
 *
 * Shaped for the dashboard rather than mirroring the table: the columns are
 * named for rows and tables, and the reader thinks in resources and people.
 */
export interface AdminActionRecord {
  id: string;
  created_at: Date;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  status: 'success';
}

/**
 * Columns common to both reads.
 *
 * actor_email is joined from staff_users: audit_logs stores only the actor's
 * id, and an audit trail that shows a uuid instead of a person is not much of
 * an audit trail. A left join, so a row whose actor has since been deleted is
 * still returned — losing the record would be worse than losing the name.
 *
 * status is a literal rather than a column, and it is accurate rather than
 * assumed: the middleware writes a row only when the response succeeded, and
 * records denied or failed attempts in the structured log instead. Every row in
 * this table is by construction a committed change.
 */
const SELECT_COLUMNS = `
  a.id,
  a.created_at,
  a.actor_id,
  s.email                AS actor_email,
  a.action,
  a.table_name           AS resource_type,
  a.record_id            AS resource_id,
  'success'::text        AS status
`;

const FROM_CLAUSE = `
  FROM audit_logs a
  LEFT JOIN staff_users s ON s.id = a.actor_id
`;

export class AuditService {
  /**
   * Audit trail for a store, optionally narrowed to one record or table.
   */
  static async getAuditTrail(
    storeId: string,
    resourceId?: string,
    resourceType?: string,
    limit = 100,
  ): Promise<AdminActionRecord[]> {
    const conditions = ['a.store_id = $1'];
    const params: unknown[] = [storeId];

    if (resourceId) {
      conditions.push(`a.record_id = $${params.length + 1}`);
      params.push(resourceId);
    }
    if (resourceType) {
      conditions.push(`a.table_name = $${params.length + 1}`);
      params.push(resourceType);
    }

    return this.run(conditions, params, limit, 'audit_trail');
  }

  /**
   * Administrative actions for a store, newest first.
   *
   * Deliberately not filtered down to approvals and rejections the way the
   * previous version was. Every admin mutation is recorded — a price change, a
   * stock adjustment, a customer being banned — and an audit view that hides
   * all but two payment actions answers the wrong question.
   */
  static async getAdminActions(
    storeId: string,
    resourceType?: string,
    limit = 100,
  ): Promise<AdminActionRecord[]> {
    const conditions = ['a.store_id = $1'];
    const params: unknown[] = [storeId];

    if (resourceType) {
      conditions.push(`a.table_name = $${params.length + 1}`);
      params.push(resourceType);
    }

    return this.run(conditions, params, limit, 'admin_actions');
  }

  /**
   * Failures return an empty list rather than throwing — an audit panel that
   * cannot load must not take the dashboard down with it. Unlike the version
   * this replaces, the error is logged rather than swallowed into a bare [],
   * so a broken query is visible instead of looking like an empty trail.
   */
  private static async run(
    conditions: string[],
    params: unknown[],
    limit: number,
    marker: string,
  ): Promise<AdminActionRecord[]> {
    try {
      const dataSource = getDataSource();
      if (!dataSource.isInitialized) {
        logError(`audit_read_failed_${marker}`, undefined, { reason: 'datasource_not_initialized' });
        return [];
      }

      const query = `
        SELECT ${SELECT_COLUMNS}
        ${FROM_CLAUSE}
        WHERE ${conditions.join(' AND ')}
        ORDER BY a.created_at DESC
        LIMIT $${params.length + 1}
      `;

      return (await dataSource.query(query, [...params, limit])) ?? [];
    } catch (error) {
      logError(`audit_read_failed_${marker}`, error instanceof Error ? error : undefined, {});
      return [];
    }
  }
}
