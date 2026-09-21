/**
 * Migration Runner Script
 * Run all pending migrations
 *
 * Usage:
 *   npm run db:migrate       -- Run migrations
 *   npm run db:migrate:undo  -- Revert last migration
 *   npm run db:migrate:show  -- Show pending migrations
 *
 * Phase 3B: Database Migrations
 */

import { runMigrations, revertMigration, getDataSource } from '../core/database/postgres-data-source.js';
import { getLogger, logInfo, logError } from '../core/logging/logger.js';

async function main(): Promise<void> {
  const command = process.argv[2] || 'run';
  const logger = getLogger();

  try {
    logInfo('Starting migration process', { command });

    switch (command) {
      case 'run': {
        await runMigrations();
        logInfo('✅ All migrations completed successfully');
        break;
      }

      case 'undo': {
        await revertMigration();
        logInfo('✅ Last migration reverted successfully');
        break;
      }

      case 'show': {
        const source = getDataSource();
        if (!source.isInitialized) {
          await source.initialize();
        }
        const pendingMigrations = await source.showMigrations();
        logInfo('Pending migrations shown');
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    process.exit(0);
  } catch (error) {
    logError('Migration failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

main();
