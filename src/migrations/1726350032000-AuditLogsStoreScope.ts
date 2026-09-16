/**
 * Migration: Scope Audit Logs To A Store
 *
 * The admin audit trail is served from a store-scoped route
 * (/stores/:storeId/dashboard/admin-actions) but audit_logs had no store
 * column, so the query could not honour the scope it was addressed with. On a
 * platform with more than one store that is a cross-store disclosure waiting to
 * happen: an administrator of one store would read another's audit trail.
 *
 * store_id is nullable rather than NOT NULL, deliberately. The previous attempt
 * at this column — removed during schema reconciliation — was NOT NULL while
 * nothing wrote it, so on a fresh database every audit insert violated the
 * constraint, was swallowed by the middleware's try/catch, and left the trail
 * silently empty. A nullable column cannot fail that way, and an audit row that
 * exists without a scope is far better than no audit row at all.
 *
 * Existing rows are backfilled to the only store that exists. Every one of them
 * was produced by admin activity against it, so this records what happened
 * rather than guessing.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogsStoreScope1726350032000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS store_id uuid`);

    // Backfill only when the answer is unambiguous — exactly one store exists.
    // With more than one there is no way to tell which store a historical row
    // belonged to, and inventing an attribution in an audit trail is worse than
    // leaving it unknown.
    await queryRunner.query(`
      UPDATE audit_logs
         SET store_id = (SELECT id FROM stores LIMIT 1)
       WHERE store_id IS NULL
         AND (SELECT COUNT(*) FROM stores) = 1
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_store_created ON audit_logs (store_id, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_store_created`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS store_id`);
  }
}
