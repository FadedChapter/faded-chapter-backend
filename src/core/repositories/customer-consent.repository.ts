/**
 * Customer Consent Repository
 * Immutable append-only consent history
 *
 * Phase 2: Repository implementation
 */

import { BaseRepository } from '../repository/base-repository';
import { CustomerConsentEntity } from '../entities/customer-consent.entity';

export class CustomerConsentRepository extends BaseRepository<CustomerConsentEntity> {
  constructor() {
    super(CustomerConsentEntity);
  }

  /**
   * Create consent record (append-only, immutable)
   * CRITICAL: Database trigger prevents mutations
   */
  async recordConsent(
    customerId: string,
    storeId: string,
    data: {
      consentType: string;
      granted: boolean;
      policyVersion: string;
      policyUrl: string;
      source: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<CustomerConsentEntity> {
    const consent = this.repository.create({
      customer_id: customerId,
      store_id: storeId,
      consent_type: data.consentType,
      granted: data.granted,
      policy_version: data.policyVersion,
      policy_url: data.policyUrl,
      source: data.source,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      created_at: new Date(),
    });

    return this.save(consent);
  }

  /**
   * Get latest consent for a type
   */
  async getLatestConsent(
    customerId: string,
    storeId: string,
    consentType: string
  ): Promise<CustomerConsentEntity | null> {
    try {
      return await this.repository.findOne({
        where: {
          customer_id: customerId,
          store_id: storeId,
          consent_type: consentType,
        } as any,
        order: { created_at: 'DESC' } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get latest consent: ${(error as Error).message}`);
    }
  }

  /**
   * Get consent history for customer
   */
  async getConsentHistory(
    customerId: string,
    storeId: string
  ): Promise<CustomerConsentEntity[]> {
    try {
      return await this.repository.find({
        where: {
          customer_id: customerId,
          store_id: storeId,
        } as any,
        order: { created_at: 'DESC', id: 'DESC' } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get consent history: ${(error as Error).message}`);
    }
  }

  /**
   * Get all consents of a type across store
   */
  async getConsentsByType(
    storeId: string,
    consentType: string
  ): Promise<CustomerConsentEntity[]> {
    try {
      return await this.repository.find({
        where: {
          store_id: storeId,
          consent_type: consentType,
        } as any,
        order: { created_at: 'DESC' } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get consents by type: ${(error as Error).message}`);
    }
  }

  /**
   * Check if customer has granted consent
   */
  async hasConsented(
    customerId: string,
    storeId: string,
    consentType: string
  ): Promise<boolean> {
    try {
      const latest = await this.getLatestConsent(customerId, storeId, consentType);
      return latest ? latest.granted : false;
    } catch (error) {
      throw new Error(`Failed to check consent: ${(error as Error).message}`);
    }
  }

  /**
   * IMPORTANT: Consent records are IMMUTABLE
   * Update and delete operations are BLOCKED at database level via trigger
   * This method should never be called
   */
  async update(): Promise<any> {
    throw new Error('Consent records are immutable and cannot be updated');
  }

  /**
   * IMPORTANT: Consent records are IMMUTABLE
   * This method should never be called
   */
  async delete(): Promise<any> {
    throw new Error('Consent records are immutable and cannot be deleted');
  }
}
