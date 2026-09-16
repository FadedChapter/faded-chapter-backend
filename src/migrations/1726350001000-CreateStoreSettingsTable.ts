/**
 * Migration: Create Store Settings Table
 * Configuration separate from store identity (1:1)
 *
 * Phase 3B: Database Migrations
 *
 * Rewritten during schema reconciliation.
 *
 * This previously described a much larger settings table — default_currency,
 * default_locale, guest_checkout_enabled, maintenance_mode, settings_json and
 * a dozen more. None of it was ever implemented or referenced by any code, and
 * the table that actually exists and is read by the admin Settings module is
 * the narrow one below.
 *
 * Editing a historical migration is normally the wrong move. It is safe here
 * because this migration had never executed against any database: the dev
 * database was built by hand, and migration history was only introduced later
 * by baselining. Rewriting it means a fresh database gets the table the
 * application actually uses, rather than one the Settings API cannot read.
 *
 * The columns the old design carried are not lost — they are simply not
 * invented ahead of the features that would use them. Add them with a new
 * migration when something needs them.
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateStoreSettingsTable1726350001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'store_settings',
        columns: [
          {
            // store_id is the primary key: settings are 1:1 with a store, so a
            // separate surrogate id would allow two settings rows per store.
            name: 'store_id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
            default: "'INR'",
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '64',
            isNullable: false,
            default: "'Asia/Kolkata'",
          },
          {
            name: 'support_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'support_phone',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'store_settings',
      new TableForeignKey({
        name: 'fk_store_settings_store_id',
        columnNames: ['store_id'],
        referencedTableName: 'stores',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('store_settings');
  }
}
