/**
 * PostgreSQL DataSource Configuration
 * TypeORM configuration for Core Domain v2.1 + Catalog Phase 4 + Orders Phase 5 + Cart Phase 6 + Promos Phase 7
 *
 * Phase 0: Infrastructure setup
 * Phase 1: Core Domain implementation (11 tables)
 * Phase 4: Catalog Domain implementation (5 tables)
 * Phase 5: Order Management implementation (2 tables)
 * Phase 6: Cart & Checkout implementation (2 tables)
 * Phase 7: Promotions & Discounts implementation (2 tables)
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getConfig } from '../config/env.js';

// Import all entities to ensure metadata is loaded
import {
  StoreEntity,
  StoreSettingsEntity,
  CustomerEntity,
  CustomerAddressEntity,
  CustomerPreferencesEntity,
  CustomerConsentEntity,
  CustomerCredentialsEntity,
  SessionEntity,
  VerificationTokenEntity,
  PasswordResetTokenEntity,
  AuditLogEntity,
  ProductEntity,
  CategoryEntity,
  ProductVariantEntity,
  InventoryEntity,
  ProductImageEntity,
  OrderEntity,
  OrderLineEntity,
  CartEntity,
  CartLineEntity,
  PromoCodeEntity,
  DiscountApplicationEntity,
  ShippingMethodEntity,
  ShippingRateEntity,
  PaymentEntity,
  RefundEntity,
} from '../entities/index.js';

/**
 * PostgreSQL DataSource
 * Lazy initialized on first use
 */
let dataSource: DataSource | null = null;

/**
 * Detect database type from DATABASE_URL
 */
function detectDatabaseType(url: string): 'postgres' | 'better-sqlite3' {
  if (url.startsWith('sqlite:')) return 'better-sqlite3';
  if (url.startsWith('postgresql://')) return 'postgres';
  return 'postgres'; // default
}

/**
 * Get or create DataSource (PostgreSQL or SQLite)
 */
export function getDataSource(): DataSource {
  if (!dataSource) {
    const config = getConfig();
    const dbType = detectDatabaseType(config.DATABASE_URL);
    const isPostgres = dbType === 'postgres';

    const baseConfig = {
      // Behavior
      synchronize: false, // Use migrations in production
      logging: ['error', 'warn'],
      logger: 'advanced-console',

      // Entities - Explicitly imported to ensure metadata is loaded
      entities: [
        StoreEntity,
        StoreSettingsEntity,
        CustomerEntity,
        CustomerAddressEntity,
        CustomerPreferencesEntity,
        CustomerConsentEntity,
        CustomerCredentialsEntity,
        SessionEntity,
        VerificationTokenEntity,
        PasswordResetTokenEntity,
        AuditLogEntity,
        ProductEntity,
        CategoryEntity,
        ProductVariantEntity,
        InventoryEntity,
        ProductImageEntity,
        OrderEntity,
        OrderLineEntity,
        CartEntity,
        CartLineEntity,
        PromoCodeEntity,
        DiscountApplicationEntity,
        ShippingMethodEntity,
        ShippingRateEntity,
        PaymentEntity,
        RefundEntity,
      ],

      // Migrations
      migrations: ['dist/migrations/*.js'],
      migrationsTableName: 'typeorm_migrations',
    };

    if (isPostgres) {
      dataSource = new DataSource({
        type: 'postgres',
        url: config.DATABASE_URL,
        extra: {
          max: config.DATABASE_POOL_MAX,
          min: config.DATABASE_POOL_MIN,
        },
        ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        ...baseConfig,
      } as any);
    } else {
      // SQLite configuration (using better-sqlite3 driver)
      dataSource = new DataSource({
        type: 'better-sqlite3',
        database: config.DATABASE_URL.replace('sqlite:', ''),
        ...baseConfig,
      } as any);
    }
  }

  return dataSource;
}

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const source = getDataSource();
    if (!source.isInitialized) {
      await source.initialize();
      const dbType = source.driver.database || 'Database';
      console.log(`✅ ${dbType} connected`);
    }
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  try {
    const source = getDataSource();
    if (source.isInitialized) {
      await source.destroy();
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Failed to close database:', error);
  }
}

/**
 * Run migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    const source = getDataSource();
    if (!source.isInitialized) {
      await source.initialize();
    }
    await source.runMigrations();
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Revert last migration
 */
export async function revertMigration(): Promise<void> {
  try {
    const source = getDataSource();
    if (!source.isInitialized) {
      await source.initialize();
    }
    await source.undoLastMigration();
    console.log('✅ Migration reverted');
  } catch (error) {
    console.error('❌ Revert failed:', error);
    throw error;
  }
}

// Lazy export - don't initialize on module load
// Server must call loadConfig() before using this
let cachedDataSource: DataSource | null = null;
export default function getOrInitializeDataSource(): DataSource {
  if (!cachedDataSource) {
    cachedDataSource = getDataSource();
  }
  return cachedDataSource;
}
