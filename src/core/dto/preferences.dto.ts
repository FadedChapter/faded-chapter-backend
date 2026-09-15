/**
 * Preferences DTOs
 * Request and response models for customer preferences
 *
 * Phase 3: API Layer
 */

export interface PreferencesDTO {
  emailNewsletter: boolean;
  emailPromotions: boolean;
  emailProductUpdates: boolean;
  emailTransactional: boolean;
  smsMarketing: boolean;
  language: string;
  timezone: string;
  savePaymentMethod: boolean;
  autoApplyRewards: boolean;
  customSettings: Record<string, any>;
}

export interface UpdateEmailPreferencesRequest {
  newsletter?: boolean;
  promotions?: boolean;
  productUpdates?: boolean;
}

export interface UpdateSmsPreferencesRequest {
  marketing: boolean;
}

export interface UpdateLocalizationRequest {
  language?: string;
  timezone?: string;
}

export interface UpdateShoppingPreferencesRequest {
  savePaymentMethod?: boolean;
  autoApplyRewards?: boolean;
}

export interface UpdateCustomSettingsRequest {
  customSettings: Record<string, any>;
}

export interface PreferencesResponse {
  preferences: PreferencesDTO;
}
