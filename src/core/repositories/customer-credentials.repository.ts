/**
 * Customer Credentials Repository
 * Password storage and authentication
 *
 * Phase 2: Repository implementation
 */

import { BaseRepository } from '../repository/base-repository';
import { CustomerCredentialsEntity } from '../entities/customer-credentials.entity';

export class CustomerCredentialsRepository extends BaseRepository<CustomerCredentialsEntity> {
  constructor() {
    super(CustomerCredentialsEntity);
  }

  /**
   * Create credentials for customer
   * CRITICAL: Never store plaintext password, only bcrypt hash
   */
  async createCredentials(
    customerId: string,
    storeId: string,
    passwordHash: string
  ): Promise<CustomerCredentialsEntity> {
    const credentials = this.repository.create({
      customer_id: customerId,
      store_id: storeId,
      password_hash: passwordHash,
      hash_algorithm: 'bcrypt',
      hash_version: 1,
      is_active: true,
      failed_login_attempts: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return this.save(credentials);
  }

  /**
   * Get credentials by customer ID
   */
  async getByCustomerId(customerId: string, storeId: string): Promise<CustomerCredentialsEntity | null> {
    try {
      return await this.repository.findOne({
        where: {
          customer_id: customerId,
          store_id: storeId,
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get credentials: ${(error as Error).message}`);
    }
  }

  /**
   * Update password hash
   */
  async updatePassword(
    customerId: string,
    storeId: string,
    newPasswordHash: string
  ): Promise<CustomerCredentialsEntity> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          password_hash: newPasswordHash,
          failed_login_attempts: 0,
          locked_until: null,
          password_changed_at: new Date(),
          updated_at: new Date(),
        }
      );

      return this.getByCustomerId(customerId, storeId) as Promise<CustomerCredentialsEntity>;
    } catch (error) {
      throw new Error(`Failed to update password: ${(error as Error).message}`);
    }
  }

  /**
   * Record successful login
   */
  async recordLoginSuccess(customerId: string, storeId: string): Promise<void> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: new Date(),
          updated_at: new Date(),
        }
      );
    } catch (error) {
      throw new Error(`Failed to record login success: ${(error as Error).message}`);
    }
  }

  /**
   * Record failed login and check for lockout
   */
  async recordLoginFailure(customerId: string, storeId: string): Promise<void> {
    try {
      const credentials = await this.getByCustomerId(customerId, storeId);

      if (!credentials) {
        throw new Error('Credentials not found');
      }

      const newAttempts = credentials.failed_login_attempts + 1;
      const maxAttempts = 5;
      const lockoutDuration = 15 * 60 * 1000; // 15 minutes

      let lockedUntil = null;
      if (newAttempts >= maxAttempts) {
        lockedUntil = new Date(Date.now() + lockoutDuration);
      }

      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          failed_login_attempts: newAttempts,
          locked_until: lockedUntil,
          updated_at: new Date(),
        }
      );
    } catch (error) {
      throw new Error(`Failed to record login failure: ${(error as Error).message}`);
    }
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(customerId: string, storeId: string): Promise<boolean> {
    try {
      const credentials = await this.getByCustomerId(customerId, storeId);

      if (!credentials) {
        return false;
      }

      if (!credentials.locked_until) {
        return false;
      }

      // Check if lockout period has expired
      if (credentials.locked_until < new Date()) {
        // Clear the lockout
        await this.recordLoginSuccess(customerId, storeId);
        return false;
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to check account lock: ${(error as Error).message}`);
    }
  }

  /**
   * Deactivate credentials (disable login)
   */
  async deactivate(customerId: string, storeId: string): Promise<void> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        { is_active: false, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to deactivate credentials: ${(error as Error).message}`);
    }
  }

  /**
   * Reactivate credentials (enable login)
   */
  async reactivate(customerId: string, storeId: string): Promise<void> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          is_active: true,
          failed_login_attempts: 0,
          locked_until: null,
          updated_at: new Date(),
        }
      );
    } catch (error) {
      throw new Error(`Failed to reactivate credentials: ${(error as Error).message}`);
    }
  }
}
