/**
 * TypeORM Migrations DataSource
 * Dedicated datasource for running migrations via CLI
 * 
 * This file is used by the TypeORM CLI tools (migration:run, migration:generate, etc.)
 * It creates a DataSource instance that can be used by the CLI.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import 'dotenv/config';

/**
 * Detect database type from DATABASE_URL
 */
function detectDatabaseType(url: string): 'postgres' | 'better-sqlite3' {
  if (url.startsWith('sqlite:')) return 'better-sqlite3';
  if (url.startsWith('postgresql://')) return 'postgres';
  return 'postgres'; // default
}

const databaseUrl = process.env.DATABASE_URL || 'sqlite:./data/faded_chapter.db';
const dbType = detectDatabaseType(databaseUrl);
const isPostgres = dbType === 'postgres';

/**
 * Create and export DataSource for TypeORM CLI
 */
const AppDataSource = new DataSource(
  isPostgres
    ? {
        type: 'postgres',
        url: databaseUrl,
        extra: {
          max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
          min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
        },
        synchronize: false,
        logging: ['error', 'warn'],
        logger: 'advanced-console',
        entities: ['dist/core/entities/*.entity.js'],
        migrations: ['dist/migrations/*.js'],
        migrationsTableName: 'typeorm_migrations',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        type: 'better-sqlite3',
        database: databaseUrl.replace('sqlite:', ''),
        synchronize: false,
        logging: ['error', 'warn'],
        logger: 'advanced-console',
        entities: ['dist/core/entities/*.entity.js'],
        migrations: ['dist/migrations/*.js'],
        migrationsTableName: 'typeorm_migrations',
      }
);

export default AppDataSource;
