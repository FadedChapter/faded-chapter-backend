/**
 * Customer Repository
 * Handles customer-related database operations with store isolation
 *
 * Phase 2: Repository implementation
 */

import { Repository } from 'typeorm';
import { BaseRepository } from '../repository/base-repository';
import { CustomerEntity } from '../entities/customer.entity';
import { ConflictError, ValidationError } from '../errors/app-error';

export class CustomerRepository extends BaseRepository<CustomerEntity> {
  constructor() {
    super(CustomerEntity);
  }

  /**
   * Find customer by email (store-isolated)
   */
  async findByEmail(email: string, storeId: string): Promise<CustomerEntity | null> {
    try {
      const normalized = email.toLowerCase().trim();
      return await this.repository.findOne({
        where: {
          store_id: storeId,
          email_normalized: normalized,
          deleted_at: null,
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to find customer by email: ${(error as Error).message}`);
    }
  }

  /**
   * Find customer by email or fail
   */
  async findByEmailOrFail(email: string, storeId: string): Promise<CustomerEntity> {
    const customer = await this.findByEmail(email, storeId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    return customer;
  }

  /**
   * Check if email exists (case-insensitive, store-isolated)
   */
  async emailExists(email: string, storeId: string, excludeCustomerId?: string): Promise<boolean> {
    try {
      const normalized = email.toLowerCase().trim();
      const query = this.repository
        .createQueryBuilder('c')
        .where('c.store_id = :storeId', { storeId })
        .andWhere('c.email_normalized = :normalized', { normalized })
        .andWhere('c.deleted_at IS NULL');

      if (excludeCustomerId) {
        query.andWhere('c.id != :customerId', { customerId: excludeCustomerId });
      }

      const count = await query.getCount();
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check email existence: ${(error as Error).message}`);
    }
  }

  /**
   * Create customer (with email normalization)
   */
  async createCustomer(data: Partial<CustomerEntity>, storeId: string): Promise<CustomerEntity> {
    // Check email doesn't already exist
    if (data.email) {
      const exists = await this.emailExists(data.email, storeId);
      if (exists) {
        throw new ConflictError('Email already in use');
      }
    }

    // Normalize email
    const normalized = data.email ? data.email.toLowerCase().trim() : '';

    const customer = this.repository.create({
      ...data,
      store_id: storeId,
      email_normalized: normalized,
      email_verified: false,
      status: 'active',
    });

    return this.save(customer);
  }

  /**
   * List all customers in store (active only)
   */
  async listByStore(
    storeId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ customers: CustomerEntity[]; total: number }> {
    try {
      const [customers, total] = await this.repository.findAndCount({
        where: {
          store_id: storeId,
          deleted_at: null,
        } as any,
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        order: { created_at: 'DESC' } as any,
      });

      return { customers, total };
    } catch (error) {
      throw new Error(`Failed to list customers: ${(error as Error).message}`);
    }
  }

  /**
   * Mark email as verified
   */
  async verifyEmail(customerId: string, storeId: string): Promise<CustomerEntity> {
    return this.update(customerId, storeId, {
      email_verified: true,
      email_verified_at: new Date(),
    } as any);
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    customerId: string,
    storeId: string,
    data: {
      first_name?: string;
      last_name?: string;
      phone?: string;
    }
  ): Promise<CustomerEntity> {
    return this.update(customerId, storeId, data as any);
  }
}
