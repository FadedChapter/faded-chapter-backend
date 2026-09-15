/**
 * Customer Preferences Repository
 * Customer communication and display preferences
 *
 * Phase 2: Repository implementation
 */

import { BaseRepository } from '../repository/base-repository';
import { CustomerPreferencesEntity } from '../entities/customer-preferences.entity';

export class CustomerPreferencesRepository extends BaseRepository<CustomerPreferencesEntity> {
  constructor() {
    super(CustomerPreferencesEntity);
  }

  /**
   * Create default preferences for new customer
   */
  async createDefaults(customerId: string, storeId: string): Promise<CustomerPreferencesEntity> {
    const preferences = this.repository.create({
      customer_id: customerId,
      store_id: storeId,
      email_newsletter: false,
      email_promotions: false,
      email_product_updates: false,
      email_transactional: true, // Always true for receipts/notifications
      sms_marketing: false,
      language: 'en',
      timezone: 'UTC',
      save_payment_method: false,
      auto_apply_rewards: false,
      custom_settings: {},
      created_at: new Date(),
      updated_at: new Date(),
    });

    return this.save(preferences);
  }

  /**
   * Get preferences by customer ID
   */
  async getByCustomerId(customerId: string, storeId: string): Promise<CustomerPreferencesEntity | null> {
    try {
      return await this.repository.findOne({
        where: {
          customer_id: customerId,
          store_id: storeId,
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get preferences: ${(error as Error).message}`);
    }
  }

  /**
   * Update email preferences
   */
  async updateEmailPreferences(
    customerId: string,
    storeId: string,
    data: {
      newsletter?: boolean;
      promotions?: boolean;
      productUpdates?: boolean;
    }
  ): Promise<CustomerPreferencesEntity> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          email_newsletter: data.newsletter,
          email_promotions: data.promotions,
          email_product_updates: data.productUpdates,
          updated_at: new Date(),
        }
      );

      return this.getByCustomerId(customerId, storeId) as Promise<CustomerPreferencesEntity>;
    } catch (error) {
      throw new Error(`Failed to update email preferences: ${(error as Error).message}`);
    }
  }

  /**
   * Update SMS preferences
   */
  async updateSmsPreferences(
    customerId: string,
    storeId: string,
    marketing: boolean
  ): Promise<CustomerPreferencesEntity> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          sms_marketing: marketing,
          updated_at: new Date(),
        }
      );

      return this.getByCustomerId(customerId, storeId) as Promise<CustomerPreferencesEntity>;
    } catch (error) {
      throw new Error(`Failed to update SMS preferences: ${(error as Error).message}`);
    }
  }

  /**
   * Update language and timezone
   */
  async updateLocalization(
    customerId: string,
    storeId: string,
    data: {
      language?: string;
      timezone?: string;
    }
  ): Promise<CustomerPreferencesEntity> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          language: data.language,
          timezone: data.timezone,
          updated_at: new Date(),
        }
      );

      return this.getByCustomerId(customerId, storeId) as Promise<CustomerPreferencesEntity>;
    } catch (error) {
      throw new Error(`Failed to update localization: ${(error as Error).message}`);
    }
  }

  /**
   * Update shopping preferences
   */
  async updateShoppingPreferences(
    customerId: string,
    storeId: string,
    data: {
      savePaymentMethod?: boolean;
      autoApplyRewards?: boolean;
    }
  ): Promise<CustomerPreferencesEntity> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          save_payment_method: data.savePaymentMethod,
          auto_apply_rewards: data.autoApplyRewards,
          updated_at: new Date(),
        }
      );

      return this.getByCustomerId(customerId, storeId) as Promise<CustomerPreferencesEntity>;
    } catch (error) {
      throw new Error(`Failed to update shopping preferences: ${(error as Error).message}`);
    }
  }

  /**
   * Update custom settings (JSONB)
   */
  async updateCustomSettings(
    customerId: string,
    storeId: string,
    customSettings: Record<string, any>
  ): Promise<CustomerPreferencesEntity> {
    try {
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        {
          custom_settings: customSettings,
          updated_at: new Date(),
        }
      );

      return this.getByCustomerId(customerId, storeId) as Promise<CustomerPreferencesEntity>;
    } catch (error) {
      throw new Error(`Failed to update custom settings: ${(error as Error).message}`);
    }
  }
}
