/**
 * Customer Address Repository
 * Reusable address management with composite FK
 *
 * Phase 2: Repository implementation
 */

import { BaseRepository } from '../repository/base-repository';
import { CustomerAddressEntity } from '../entities/customer-address.entity';

export class CustomerAddressRepository extends BaseRepository<CustomerAddressEntity> {
  constructor() {
    super(CustomerAddressEntity);
  }

  /**
   * Create address for customer
   * Composite FK: (customer_id, store_id) → customers(id, store_id)
   */
  async createAddress(
    customerId: string,
    storeId: string,
    data: {
      firstName: string;
      lastName: string;
      phone?: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      countryCode: string;
      type: 'shipping' | 'billing';
      isDefaultShipping?: boolean;
      isDefaultBilling?: boolean;
      label?: string;
    }
  ): Promise<CustomerAddressEntity> {
    const address = this.repository.create({
      customer_id: customerId,
      store_id: storeId,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone || null,
      address_line_1: data.addressLine1,
      address_line_2: data.addressLine2 || null,
      city: data.city,
      state_province: data.stateProvince,
      postal_code: data.postalCode,
      country_code: data.countryCode,
      type: data.type,
      is_default_shipping: data.isDefaultShipping || false,
      is_default_billing: data.isDefaultBilling || false,
      label: data.label || null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return this.save(address);
  }

  /**
   * Get all addresses for customer
   */
  async getCustomerAddresses(customerId: string, storeId: string): Promise<CustomerAddressEntity[]> {
    try {
      return await this.repository.find({
        where: {
          customer_id: customerId,
          store_id: storeId,
        } as any,
        order: { created_at: 'DESC' } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get customer addresses: ${(error as Error).message}`);
    }
  }

  /**
   * Get default shipping address
   */
  async getDefaultShippingAddress(
    customerId: string,
    storeId: string
  ): Promise<CustomerAddressEntity | null> {
    try {
      return await this.repository.findOne({
        where: {
          customer_id: customerId,
          store_id: storeId,
          is_default_shipping: true,
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get default shipping address: ${(error as Error).message}`);
    }
  }

  /**
   * Get default billing address
   */
  async getDefaultBillingAddress(
    customerId: string,
    storeId: string
  ): Promise<CustomerAddressEntity | null> {
    try {
      return await this.repository.findOne({
        where: {
          customer_id: customerId,
          store_id: storeId,
          is_default_billing: true,
        } as any,
      });
    } catch (error) {
      throw new Error(`Failed to get default billing address: ${(error as Error).message}`);
    }
  }

  /**
   * Set as default shipping address
   */
  async setDefaultShippingAddress(
    addressId: string,
    customerId: string,
    storeId: string
  ): Promise<void> {
    try {
      // Clear other defaults for this customer
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        { is_default_shipping: false }
      );

      // Set this as default
      await this.repository.update(
        { id: addressId, customer_id: customerId, store_id: storeId } as any,
        { is_default_shipping: true, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to set default shipping address: ${(error as Error).message}`);
    }
  }

  /**
   * Set as default billing address
   */
  async setDefaultBillingAddress(
    addressId: string,
    customerId: string,
    storeId: string
  ): Promise<void> {
    try {
      // Clear other defaults for this customer
      await this.repository.update(
        { customer_id: customerId, store_id: storeId } as any,
        { is_default_billing: false }
      );

      // Set this as default
      await this.repository.update(
        { id: addressId, customer_id: customerId, store_id: storeId } as any,
        { is_default_billing: true, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to set default billing address: ${(error as Error).message}`);
    }
  }

  /**
   * Update address
   */
  async updateAddress(
    addressId: string,
    customerId: string,
    storeId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      countryCode: string;
      label: string;
    }>
  ): Promise<CustomerAddressEntity> {
    try {
      await this.repository.update(
        { id: addressId, customer_id: customerId, store_id: storeId } as any,
        {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          address_line_1: data.addressLine1,
          address_line_2: data.addressLine2,
          city: data.city,
          state_province: data.stateProvince,
          postal_code: data.postalCode,
          country_code: data.countryCode,
          label: data.label,
          updated_at: new Date(),
        }
      );

      return this.findByIdOrFail(addressId, storeId);
    } catch (error) {
      throw new Error(`Failed to update address: ${(error as Error).message}`);
    }
  }
}
