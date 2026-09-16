/**
 * Migration: Unique Store Domain
 *
 * The last structural difference between the hand-built database and the
 * migrations. A store's custom domain is how an incoming request is routed to
 * a store, so two stores claiming the same domain is not a data-quality
 * nuisance — it is an ambiguous lookup.
 *
 * Named explicitly rather than left to the auto-generated constraint name the
 * entity produces, so the two databases converge on the same name as well as
 * the same rule.
 *
 * Safe on existing data: NULLs do not conflict under a unique index in
 * Postgres, and no store currently sets a domain.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueStoreDomain1726350031000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the entity-generated equivalent if it is present, so both databases
    // end up with one unique index under one predictable name.
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT conname INTO c FROM pg_constraint
         WHERE conrelid = 'stores'::regclass AND contype = 'u'
           AND pg_get_constraintdef(oid) = 'UNIQUE (domain)';
        IF c IS NOT NULL THEN
          EXECUTE format('ALTER TABLE stores DROP CONSTRAINT %I', c);
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_domain ON stores (domain)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_stores_domain`);
  }
}
