/**
 * Soft Delete Integration Tests
 * Verify soft delete and restore functionality
 *
 * Phase 3C: Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { CustomerRepository } from '../../core/repositories/customer.repository.js';
import { CustomerAddressRepository } from '../../core/repositories/customer-address.repository.js';
import { createTestStore, createTestCustomer } from '../setup.js';
import { testUser, createTestAddress } from '../helpers.js';

describe('Soft Delete Tests', () => {
  let store1Id: string;
  let customerRepo: CustomerRepository;
  let addressRepo: CustomerAddressRepository;

  beforeEach(async () => {
    store1Id = await createTestStore();
    customerRepo = new CustomerRepository();
    addressRepo = new CustomerAddressRepository();
  });

  describe('Customer Soft Delete', () => {
    it('should mark customer as deleted without removing', async () => {
      const customer = await createTestCustomer(store1Id);

      // Soft delete
      await customerRepo.softDelete(customer.id, store1Id);

      // Can still find in database
      const found = await customerRepo.repository.findOne({
        where: { id: customer.id, store_id: store1Id },
      });

      expect(found).toBeDefined();
      expect(found?.deleted_at).toBeDefined();
    });

    it('should hide deleted customers from normal queries', async () => {
      const customer = await createTestCustomer(store1Id);

      await customerRepo.softDelete(customer.id, store1Id);

      // findById should return null for deleted
      const found = await customerRepo.findById(customer.id, store1Id);
      expect(found).toBeNull();
    });

    it('should allow email reuse after soft delete', async () => {
      const email = 'reusable@example.com';
      const customer1 = await customerRepo.repository.create({
        id: uuidv4(),
        store_id: store1Id,
        email,
        email_normalized: email.toLowerCase(),
        status: 'active',
      });
      await customerRepo.save(customer1);

      // Soft delete customer
      await customerRepo.softDelete(customer1.id, store1Id);

      // Should be able to register with same email
      const customer2 = await customerRepo.repository.create({
        id: uuidv4(),
        store_id: store1Id,
        email,
        email_normalized: email.toLowerCase(),
        status: 'active',
      });
      await customerRepo.save(customer2);

      expect(customer2.id).not.toBe(customer1.id);
    });

    it('should restore deleted customer', async () => {
      const customer = await createTestCustomer(store1Id);

      // Soft delete then restore
      await customerRepo.softDelete(customer.id, store1Id);
      await customerRepo.restore(customer.id, store1Id);

      const found = await customerRepo.findById(customer.id, store1Id);
      expect(found).toBeDefined();
      expect(found?.deleted_at).toBeNull();
    });

    it('should not allow duplicate email when restoring', async () => {
      const email = 'test@example.com';
      const customer1 = await customerRepo.repository.create({
        id: uuidv4(),
        store_id: store1Id,
        email,
        email_normalized: email.toLowerCase(),
      });
      await customerRepo.save(customer1);

      const customer2 = await customerRepo.repository.create({
        id: uuidv4(),
        store_id: store1Id,
        email,
        email_normalized: email.toLowerCase(),
      });
      await customerRepo.save(customer2);

      // Soft delete and restore both - one should fail on unique constraint
      await customerRepo.softDelete(customer2.id, store1Id);

      expect(customerRepo.restore(customer2.id, store1Id)).rejects.toThrow();
    });
  });

  describe('Address Soft Delete', () => {
    let customerId: string;

    beforeEach(async () => {
      const customer = await createTestCustomer(store1Id);
      customerId = customer.id;
    });

    it('should soft delete address', async () => {
      const address = await addressRepo.createAddress(customerId, store1Id, createTestAddress());

      await addressRepo.softDelete(address.id, store1Id);

      const found = await addressRepo.findById(address.id, store1Id);
      expect(found).toBeNull();
    });

    it('should remove from list after soft delete', async () => {
      const address1 = await addressRepo.createAddress(customerId, store1Id, createTestAddress());
      const address2 = await addressRepo.createAddress(
        customerId,
        store1Id,
        createTestAddress({ city: 'New York' })
      );

      await addressRepo.softDelete(address1.id, store1Id);

      const addresses = await addressRepo.getCustomerAddresses(customerId, store1Id);
      expect(addresses).toHaveLength(1);
      expect(addresses[0].id).toBe(address2.id);
    });

    it('should restore deleted address', async () => {
      const address = await addressRepo.createAddress(customerId, store1Id, createTestAddress());

      await addressRepo.softDelete(address.id, store1Id);
      await addressRepo.restore(address.id, store1Id);

      const found = await addressRepo.findById(address.id, store1Id);
      expect(found).toBeDefined();
      expect(found?.deleted_at).toBeNull();
    });

    it('should cascade delete addresses when customer deleted', async () => {
      const address1 = await addressRepo.createAddress(customerId, store1Id, createTestAddress());
      const address2 = await addressRepo.createAddress(
        customerId,
        store1Id,
        createTestAddress({ city: 'Boston' })
      );

      // Soft delete customer
      await customerRepo.softDelete(customerId, store1Id);

      // Addresses should still exist in DB but should be hidden
      const addresses = await addressRepo.getCustomerAddresses(customerId, store1Id);
      expect(addresses).toHaveLength(0);

      // But if we query with soft-delete filtering removed, they're still there
      const allAddresses = await addressRepo.repository.find({
        where: { customer_id: customerId, store_id: store1Id },
      });
      expect(allAddresses.length).toBeGreaterThan(0);
    });
  });

  describe('Soft Delete with Unique Constraints', () => {
    it('should respect unique constraint with deleted_at IS NULL', async () => {
      const email = 'unique@example.com';

      // Create first customer
      const customerId1 = uuidv4();
      const customer1 = await customerRepo.repository.create({
        id: customerId1,
        store_id: store1Id,
        email,
        email_normalized: email.toLowerCase(),
      });
      await customerRepo.save(customer1);

      // Soft delete
      await customerRepo.softDelete(customer1.id, store1Id);

      // Create second customer with same email
      const customerId2 = uuidv4();
      const customer2 = await customerRepo.repository.create({
        id: customerId2,
        store_id: store1Id,
        email,
        email_normalized: email.toLowerCase(),
      });
      await customerRepo.save(customer2);

      expect(customer2.id).not.toBe(customer1.id);

      // Get only active emails
      const customer1Check = await customerRepo.findByEmail(email, store1Id);
      expect(customer1Check?.id).toBe(customer2.id); // Should get the active one
    });
  });

  describe('Audit Trail Preservation', () => {
    it('should preserve deleted customer in audit logs', async () => {
      const customer = await createTestCustomer(store1Id);
      const customerId = customer.id;

      const { AuditLogRepository } = await import('../../core/repositories/audit-log.repository.js');
      const repo = new AuditLogRepository();

      // Log customer creation
      await repo.createEntry(store1Id, {
        tableName: 'customers',
        recordId: customerId,
        actorId: 'system',
        actorType: 'system',
        action: 'insert',
        changes: {},
      });

      // Soft delete
      await customerRepo.softDelete(customerId, store1Id);

      // Log customer deletion
      await repo.createEntry(store1Id, {
        tableName: 'customers',
        recordId: customerId,
        actorId: 'system',
        actorType: 'system',
        action: 'delete',
        changes: { deleted_at: { old: null, new: 'NOW()' } },
      });

      // Audit logs should still be accessible
      const history = await repo.getRecordHistory(store1Id, 'customers', customerId);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some((log) => log.action === 'insert')).toBe(true);
      expect(history.some((log) => log.action === 'delete')).toBe(true);
    });
  });

  describe('Timestamp Management', () => {
    it('should set deleted_at timestamp on soft delete', async () => {
      const customer = await createTestCustomer(store1Id);

      await customerRepo.softDelete(customer.id, store1Id);

      const record = await customerRepo.repository.findOne({
        where: { id: customer.id, store_id: store1Id },
      });

      expect(record?.deleted_at).toBeDefined();
      expect(record?.deleted_at instanceof Date).toBe(true);
    });

    it('should clear deleted_at timestamp on restore', async () => {
      const customer = await createTestCustomer(store1Id);

      await customerRepo.softDelete(customer.id, store1Id);
      await customerRepo.restore(customer.id, store1Id);

      const record = await customerRepo.repository.findOne({
        where: { id: customer.id, store_id: store1Id },
      });

      expect(record?.deleted_at).toBeNull();
    });

    it('should use current UTC timestamp for deleted_at', async () => {
      const before = new Date();
      const customer = await createTestCustomer(store1Id);
      await customerRepo.softDelete(customer.id, store1Id);
      const after = new Date();

      const record = await customerRepo.repository.findOne({
        where: { id: customer.id, store_id: store1Id },
      });

      const deletedAt = new Date(record?.deleted_at);
      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(deletedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
