/**
 * Address Controller
 * Handles customer address management endpoints
 *
 * Phase 3: API Layer
 */

import { Request, Response } from 'express';
import { CustomerAddressRepository } from '../repositories/customer-address.repository';
import { AddressDTO, CreateAddressRequest, UpdateAddressRequest, ListAddressesResponse } from '../dto/index';
import { ValidationError } from '../errors/app-error';

export class AddressController {
  private addressRepository: CustomerAddressRepository;

  constructor() {
    this.addressRepository = new CustomerAddressRepository();
  }

  /**
   * List all addresses for customer
   * GET /addresses
   * Requires: Authentication
   */
  async listAddresses(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    const addresses = await this.addressRepository.getCustomerAddresses(customerId, storeId);

    const addressDTOs: AddressDTO[] = addresses.map((addr) => ({
      id: addr.id,
      type: addr.type as 'shipping' | 'billing',
      firstName: addr.first_name,
      lastName: addr.last_name,
      phone: addr.phone,
      addressLine1: addr.address_line_1,
      addressLine2: addr.address_line_2,
      city: addr.city,
      stateProvince: addr.state_province,
      postalCode: addr.postal_code,
      countryCode: addr.country_code,
      isDefaultShipping: addr.is_default_shipping,
      isDefaultBilling: addr.is_default_billing,
      label: addr.label,
      createdAt: addr.created_at,
      updatedAt: addr.updated_at,
    }));

    const response: ListAddressesResponse = {
      addresses: addressDTOs,
    };

    res.status(200).json(response);
  }

  /**
   * Create new address
   * POST /addresses
   * Requires: Authentication
   */
  async createAddress(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: CreateAddressRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    // Validate required fields
    if (
      !body.firstName ||
      !body.lastName ||
      !body.addressLine1 ||
      !body.city ||
      !body.stateProvince ||
      !body.postalCode ||
      !body.countryCode ||
      !body.type
    ) {
      throw new ValidationError('All required address fields must be provided');
    }

    const address = await this.addressRepository.createAddress(customerId, storeId, {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      stateProvince: body.stateProvince,
      postalCode: body.postalCode,
      countryCode: body.countryCode,
      type: body.type,
      label: body.label,
    });

    const response: AddressDTO = {
      id: address.id,
      type: address.type as 'shipping' | 'billing',
      firstName: address.first_name,
      lastName: address.last_name,
      phone: address.phone,
      addressLine1: address.address_line_1,
      addressLine2: address.address_line_2,
      city: address.city,
      stateProvince: address.state_province,
      postalCode: address.postal_code,
      countryCode: address.country_code,
      isDefaultShipping: address.is_default_shipping,
      isDefaultBilling: address.is_default_billing,
      label: address.label,
      createdAt: address.created_at,
      updatedAt: address.updated_at,
    };

    res.status(201).json(response);
  }

  /**
   * Update address
   * PATCH /addresses/:addressId
   * Requires: Authentication
   */
  async updateAddress(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const { addressId } = req.params;
    const body: UpdateAddressRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!addressId) {
      throw new ValidationError('Address ID is required');
    }

    const updated = await this.addressRepository.updateAddress(addressId, customerId, storeId, {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      stateProvince: body.stateProvince,
      postalCode: body.postalCode,
      countryCode: body.countryCode,
      label: body.label,
    });

    const response: AddressDTO = {
      id: updated.id,
      type: updated.type as 'shipping' | 'billing',
      firstName: updated.first_name,
      lastName: updated.last_name,
      phone: updated.phone,
      addressLine1: updated.address_line_1,
      addressLine2: updated.address_line_2,
      city: updated.city,
      stateProvince: updated.state_province,
      postalCode: updated.postal_code,
      countryCode: updated.country_code,
      isDefaultShipping: updated.is_default_shipping,
      isDefaultBilling: updated.is_default_billing,
      label: updated.label,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };

    res.status(200).json(response);
  }

  /**
   * Delete address (soft delete)
   * DELETE /addresses/:addressId
   * Requires: Authentication
   */
  async deleteAddress(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const { addressId } = req.params;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!addressId) {
      throw new ValidationError('Address ID is required');
    }

    await this.addressRepository.softDelete(addressId, storeId);

    res.status(200).json({
      message: 'Address deleted',
    });
  }

  /**
   * Set as default shipping address
   * POST /addresses/:addressId/set-default-shipping
   * Requires: Authentication
   */
  async setDefaultShipping(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const { addressId } = req.params;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!addressId) {
      throw new ValidationError('Address ID is required');
    }

    await this.addressRepository.setDefaultShippingAddress(addressId, customerId, storeId);

    res.status(200).json({
      message: 'Default shipping address updated',
    });
  }

  /**
   * Set as default billing address
   * POST /addresses/:addressId/set-default-billing
   * Requires: Authentication
   */
  async setDefaultBilling(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const { addressId } = req.params;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!addressId) {
      throw new ValidationError('Address ID is required');
    }

    await this.addressRepository.setDefaultBillingAddress(addressId, customerId, storeId);

    res.status(200).json({
      message: 'Default billing address updated',
    });
  }
}
