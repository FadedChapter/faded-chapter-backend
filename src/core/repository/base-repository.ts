/**
 * Base Repository Class
 * Provides common repository patterns for Core Domain tables
 *
 * All repositories inherit from this to ensure:
 * - Store isolation (all queries filtered by store_id)
 * - Soft delete handling
 * - Consistent error handling
 * - Transaction support
 *
 * Phase 0: Infrastructure setup
 * Phase 1: Used by all 11 Core Domain repositories
 */

import { Repository, SelectQueryBuilder, FindManyOptions, UpdateResult, DeleteResult } from 'typeorm';
import { getDataSource } from '../database/postgres-data-source';
import { StoreIsolationError, NotFoundError, DatabaseError } from '../errors/app-error';
import { logError, createChildLogger } from '../logging/logger';

/**
 * Abstract base repository with store isolation
 */
export abstract class BaseRepository<T extends { id: string; store_id: string }> {
  protected repository: Repository<T>;
  protected logger = createChildLogger(this.constructor.name);

  constructor(entityClass: { new (): T }) {
    const dataSource = getDataSource();
    this.repository = dataSource.getRepository(entityClass);
  }

  /**
   * Verify that record belongs to store before operating on it
   */
  protected verifyStoreOwnership(record: T | null, storeId: string): T {
    if (!record) {
      throw new NotFoundError(this.constructor.name);
    }

    if (record.store_id !== storeId) {
      this.logger.warn('Store isolation violation attempt', {
        recordStoreId: record.store_id,
        requestStoreId: storeId,
      });
      throw new StoreIsolationError();
    }

    return record;
  }

  /**
   * Find one record by ID (with store isolation)
   */
  async findById(id: string, storeId: string): Promise<T | null> {
    try {
      const record = await this.repository.findOne({
        where: { id, store_id: storeId } as any,
      });
      return record;
    } catch (error) {
      throw new DatabaseError(`Failed to find ${this.constructor.name} by ID`, error as Error);
    }
  }

  /**
   * Find one and throw if not found (with store isolation)
   */
  async findByIdOrFail(id: string, storeId: string): Promise<T> {
    const record = await this.findById(id, storeId);
    return this.verifyStoreOwnership(record, storeId);
  }

  /**
   * Find multiple records by store (excludes soft-deleted)
   */
  async findByStore(storeId: string, options?: FindManyOptions<T>): Promise<T[]> {
    try {
      return await this.repository.find({
        ...options,
        where: { store_id: storeId, ...(options?.where || {}) } as any,
      });
    } catch (error) {
      throw new DatabaseError(`Failed to find ${this.constructor.name} records`, error as Error);
    }
  }

  /**
   * Save (insert or update) a record
   */
  async save(entity: T): Promise<T> {
    try {
      return await this.repository.save(entity);
    } catch (error) {
      const dbError = error as Error;
      if (dbError.message.includes('unique constraint')) {
        throw new Error(`Duplicate entry: ${dbError.message}`);
      }
      throw new DatabaseError(`Failed to save ${this.constructor.name}`, dbError);
    }
  }

  /**
   * Update record (with store isolation)
   */
  async update(id: string, storeId: string, updates: Partial<T>): Promise<T> {
    // Verify ownership first
    const existing = await this.findByIdOrFail(id, storeId);

    // Update
    try {
      await this.repository.update({ id, store_id: storeId } as any, updates as any);
      return { ...existing, ...updates } as T;
    } catch (error) {
      throw new DatabaseError(`Failed to update ${this.constructor.name}`, error as Error);
    }
  }

  /**
   * Soft delete: set deleted_at timestamp
   * Does NOT remove the record from the database
   */
  async softDelete(id: string, storeId: string): Promise<void> {
    try {
      const existing = await this.findByIdOrFail(id, storeId);
      await this.repository.update(
        { id, store_id: storeId } as any,
        { deleted_at: new Date() } as any
      );
    } catch (error) {
      throw new DatabaseError(`Failed to soft delete ${this.constructor.name}`, error as Error);
    }
  }

  /**
   * Restore soft-deleted record
   */
  async restore(id: string, storeId: string): Promise<T> {
    try {
      const existing = await this.findByIdOrFail(id, storeId);
      await this.repository.update(
        { id, store_id: storeId } as any,
        { deleted_at: null } as any
      );
      return { ...existing, deleted_at: null } as T;
    } catch (error) {
      throw new DatabaseError(`Failed to restore ${this.constructor.name}`, error as Error);
    }
  }

  /**
   * Check if store has any records
   */
  async hasRecords(storeId: string): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: { store_id: storeId } as any,
      });
      return count > 0;
    } catch (error) {
      throw new DatabaseError(`Failed to count ${this.constructor.name} records`, error as Error);
    }
  }

  /**
   * Get count of records in store
   */
  async countByStore(storeId: string): Promise<number> {
    try {
      return await this.repository.count({
        where: { store_id: storeId } as any,
      });
    } catch (error) {
      throw new DatabaseError(`Failed to count ${this.constructor.name} records`, error as Error);
    }
  }
}
