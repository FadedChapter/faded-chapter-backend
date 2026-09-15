/**
 * Customer Service
 * Business logic for customer management
 *
 * Phase 2: Service implementation
 */

import { CustomerRepository } from '../repositories/customer.repository';
import { CustomerEntity } from '../entities/customer.entity';
import { ValidationError, ConflictError } from '../errors/app-error';

export class CustomerService {
  private repository: CustomerRepository;

  constructor() {
    this.repository = new CustomerRepository();
  }

  /**
   * Register new customer
   */
  async registerCustomer(
    storeId: string,
    data: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<CustomerEntity> {
    // Validate email
    if (!this.isValidEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Check email doesn't exist
    const exists = await this.repository.emailExists(data.email, storeId);
    if (exists) {
      throw new ConflictError('Email already registered');
    }

    // Validate phone if provided
    if (data.phone && !this.isValidPhone(data.phone)) {
      throw new ValidationError('Invalid phone format');
    }

    // Create customer
    return this.repository.createCustomer(
      {
        email: data.email,
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        phone: data.phone || null,
      },
      storeId
    );
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string, storeId: string): Promise<CustomerEntity> {
    return this.repository.findByIdOrFail(customerId, storeId);
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string, storeId: string): Promise<CustomerEntity> {
    return this.repository.findByEmailOrFail(email, storeId);
  }

  /**
   * Verify customer email
   */
  async verifyEmail(customerId: string, storeId: string): Promise<CustomerEntity> {
    const customer = await this.repository.findByIdOrFail(customerId, storeId);

    if (customer.email_verified) {
      throw new ValidationError('Email already verified');
    }

    return this.repository.verifyEmail(customerId, storeId);
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    customerId: string,
    storeId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<CustomerEntity> {
    // Validate phone if provided
    if (data.phone && !this.isValidPhone(data.phone)) {
      throw new ValidationError('Invalid phone format');
    }

    return this.repository.updateProfile(customerId, storeId, {
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
    } as any);
  }

  /**
   * Delete customer (soft delete)
   */
  async deleteCustomer(customerId: string, storeId: string): Promise<void> {
    await this.repository.softDelete(customerId, storeId);
  }

  /**
   * Restore customer
   */
  async restoreCustomer(customerId: string, storeId: string): Promise<CustomerEntity> {
    return this.repository.restore(customerId, storeId);
  }

  /**
   * Normalize email (lowercase + trim)
   */
  normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Normalize phone to E.164 format
   * This is simplified - full implementation would use libphonenumber
   */
  normalizePhone(phone: string, countryCode?: string): string {
    // Remove spaces, hyphens, parentheses
    let normalized = phone.replace(/[\s\-\(\)]/g, '');

    // Ensure starts with +
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    return normalized;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Validate phone format (E.164)
   */
  private isValidPhone(phone: string): boolean {
    // Simplified validation - must start with + and have 8-15 digits
    const regex = /^\+[1-9]\d{7,14}$/;
    return regex.test(phone);
  }
}
