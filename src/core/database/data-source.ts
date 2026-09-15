/**
 * TypeORM Data Source Configuration
 * SQLite database setup for development and production
 * Phase 3F.2: Database migration from in-memory store
 */

// MUST be imported before any TypeORM entities
import 'reflect-metadata';

import { DataSource } from 'typeorm';
import path from 'path';
import { fileURLToPath } from 'url';

// Import entities after reflect-metadata
import { UserEntity } from '../user/entities/user.entity';
import { SessionEntity } from '../session/entities/session.entity';
import { EmailVerificationEntity } from '../email/entities/email-verification.entity';
import { PasswordResetEntity } from '../password/entities/password-reset.entity';
import { OrderEntity } from '../orders/entities/order.entity';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SQLite database path
 * Uses a file-based database in the project root
 * Can be changed to PostgreSQL connection string for production
 */
const databasePath = process.env['DATABASE_PATH'] || path.join(__dirname, '../../..', 'faded-chapter.db');

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: databasePath,
  synchronize: process.env['NODE_ENV'] !== 'production', // Auto-create tables in dev
  logging: process.env['NODE_ENV'] === 'development',
  entities: [UserEntity, SessionEntity, EmailVerificationEntity, PasswordResetEntity, OrderEntity],
  subscribers: [],
  migrations: [],
});

/**
 * Initialize database connection
 * Call this once when the server starts
 */
export async function initializeDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('[Database] ✅ SQLite database initialized');
      console.log(`[Database] 📁 Database file: ${databasePath}`);
    }
  } catch (error) {
    console.error('[Database] ❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connection
 * Call this when the server shuts down
 */
export async function closeDatabase(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('[Database] ✅ Database connection closed');
    }
  } catch (error) {
    console.error('[Database] ❌ Failed to close database:', error);
  }
}
