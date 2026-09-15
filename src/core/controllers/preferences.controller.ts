/**
 * Preferences Controller
 * Handles customer preferences endpoints
 *
 * Phase 3: API Layer
 */

import { Request, Response } from 'express';
import { CustomerPreferencesRepository } from '../repositories/customer-preferences.repository';
import {
  PreferencesDTO,
  PreferencesResponse,
  UpdateEmailPreferencesRequest,
  UpdateSmsPreferencesRequest,
  UpdateLocalizationRequest,
  UpdateShoppingPreferencesRequest,
  UpdateCustomSettingsRequest,
} from '../dto/index';
import { ValidationError } from '../errors/app-error';

export class PreferencesController {
  private preferencesRepository: CustomerPreferencesRepository;

  constructor() {
    this.preferencesRepository = new CustomerPreferencesRepository();
  }

  /**
   * Get customer preferences
   * GET /preferences
   * Requires: Authentication
   */
  async getPreferences(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    const preferences = await this.preferencesRepository.getByCustomerId(customerId, storeId);

    if (!preferences) {
      throw new ValidationError('Preferences not found');
    }

    const response: PreferencesResponse = {
      preferences: {
        emailNewsletter: preferences.email_newsletter,
        emailPromotions: preferences.email_promotions,
        emailProductUpdates: preferences.email_product_updates,
        emailTransactional: preferences.email_transactional,
        smsMarketing: preferences.sms_marketing,
        language: preferences.language,
        timezone: preferences.timezone,
        savePaymentMethod: preferences.save_payment_method,
        autoApplyRewards: preferences.auto_apply_rewards,
        customSettings: preferences.custom_settings || {},
      },
    };

    res.status(200).json(response);
  }

  /**
   * Update email preferences
   * PATCH /preferences/email
   * Requires: Authentication
   */
  async updateEmailPreferences(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: UpdateEmailPreferencesRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    const updated = await this.preferencesRepository.updateEmailPreferences(customerId, storeId, {
      newsletter: body.newsletter,
      promotions: body.promotions,
      productUpdates: body.productUpdates,
    });

    const response: PreferencesResponse = {
      preferences: {
        emailNewsletter: updated.email_newsletter,
        emailPromotions: updated.email_promotions,
        emailProductUpdates: updated.email_product_updates,
        emailTransactional: updated.email_transactional,
        smsMarketing: updated.sms_marketing,
        language: updated.language,
        timezone: updated.timezone,
        savePaymentMethod: updated.save_payment_method,
        autoApplyRewards: updated.auto_apply_rewards,
        customSettings: updated.custom_settings || {},
      },
    };

    res.status(200).json(response);
  }

  /**
   * Update SMS preferences
   * PATCH /preferences/sms
   * Requires: Authentication
   */
  async updateSmsPreferences(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: UpdateSmsPreferencesRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (body.marketing === undefined) {
      throw new ValidationError('Marketing preference is required');
    }

    const updated = await this.preferencesRepository.updateSmsPreferences(
      customerId,
      storeId,
      body.marketing
    );

    const response: PreferencesResponse = {
      preferences: {
        emailNewsletter: updated.email_newsletter,
        emailPromotions: updated.email_promotions,
        emailProductUpdates: updated.email_product_updates,
        emailTransactional: updated.email_transactional,
        smsMarketing: updated.sms_marketing,
        language: updated.language,
        timezone: updated.timezone,
        savePaymentMethod: updated.save_payment_method,
        autoApplyRewards: updated.auto_apply_rewards,
        customSettings: updated.custom_settings || {},
      },
    };

    res.status(200).json(response);
  }

  /**
   * Update localization preferences
   * PATCH /preferences/localization
   * Requires: Authentication
   */
  async updateLocalization(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: UpdateLocalizationRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!body.language && !body.timezone) {
      throw new ValidationError('At least one field must be provided');
    }

    const updated = await this.preferencesRepository.updateLocalization(customerId, storeId, {
      language: body.language,
      timezone: body.timezone,
    });

    const response: PreferencesResponse = {
      preferences: {
        emailNewsletter: updated.email_newsletter,
        emailPromotions: updated.email_promotions,
        emailProductUpdates: updated.email_product_updates,
        emailTransactional: updated.email_transactional,
        smsMarketing: updated.sms_marketing,
        language: updated.language,
        timezone: updated.timezone,
        savePaymentMethod: updated.save_payment_method,
        autoApplyRewards: updated.auto_apply_rewards,
        customSettings: updated.custom_settings || {},
      },
    };

    res.status(200).json(response);
  }

  /**
   * Update shopping preferences
   * PATCH /preferences/shopping
   * Requires: Authentication
   */
  async updateShoppingPreferences(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: UpdateShoppingPreferencesRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (body.savePaymentMethod === undefined && body.autoApplyRewards === undefined) {
      throw new ValidationError('At least one field must be provided');
    }

    const updated = await this.preferencesRepository.updateShoppingPreferences(customerId, storeId, {
      savePaymentMethod: body.savePaymentMethod,
      autoApplyRewards: body.autoApplyRewards,
    });

    const response: PreferencesResponse = {
      preferences: {
        emailNewsletter: updated.email_newsletter,
        emailPromotions: updated.email_promotions,
        emailProductUpdates: updated.email_product_updates,
        emailTransactional: updated.email_transactional,
        smsMarketing: updated.sms_marketing,
        language: updated.language,
        timezone: updated.timezone,
        savePaymentMethod: updated.save_payment_method,
        autoApplyRewards: updated.auto_apply_rewards,
        customSettings: updated.custom_settings || {},
      },
    };

    res.status(200).json(response);
  }

  /**
   * Update custom settings
   * PATCH /preferences/custom
   * Requires: Authentication
   */
  async updateCustomSettings(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: UpdateCustomSettingsRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!body.customSettings) {
      throw new ValidationError('Custom settings are required');
    }

    const updated = await this.preferencesRepository.updateCustomSettings(
      customerId,
      storeId,
      body.customSettings
    );

    const response: PreferencesResponse = {
      preferences: {
        emailNewsletter: updated.email_newsletter,
        emailPromotions: updated.email_promotions,
        emailProductUpdates: updated.email_product_updates,
        emailTransactional: updated.email_transactional,
        smsMarketing: updated.sms_marketing,
        language: updated.language,
        timezone: updated.timezone,
        savePaymentMethod: updated.save_payment_method,
        autoApplyRewards: updated.auto_apply_rewards,
        customSettings: updated.custom_settings || {},
      },
    };

    res.status(200).json(response);
  }
}
