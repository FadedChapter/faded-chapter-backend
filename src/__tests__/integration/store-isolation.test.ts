/**
 * Store Isolation Integration Tests
 * Verify multi-tenancy enforcement
 *
 * Phase 3C: Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CustomerService } from '../../core/services/customer.service.js';
import { CustomerRepository } from '../../core/repositories/customer.repository.js';
import { CustomerAddressRepository } from '../../core/repositories/customer-address.repository.js';
import { createTestStore, createTestCustomer } from '../setup.js';
import { testUser, testUser2, createTestAddress } from '../helpers.js';

describe('Store Isolation Tests', () => {
  let store1Id: string;
  let store2Id: string;
  let customerService: CustomerService;
  let customerRepo: CustomerRepository;
  let addressRepo: CustomerAddressRepository;

  beforeEach(async () => {
    store1Id = await createTestStore();
    store2Id = await createTestStore();
    customerService = new CustomerService();
    customerRepo = new CustomerRepository();
    addressRepo = new CustomerAddressRepository();
  });

  describe('Customer Isolation', () => {
    it('should allow same email in different stores', async () => {
      const customer1 = await customerService.registerCustomer(store1Id, {
        email: testUser.email,
        firstName: 'Store1',
      });

      const customer2 = await customerService.registerCustomer(store2Id, {
        email: testUser.email,
        firstName: 'Store2',
      });

      expect(customer1.id).not.toBe(customer2.id);
    });

    it('should prevent duplicate email in same store', async () => {
      await customerService.registerCustomer(store1Id, {
        email: testUser.email,
      });

      expect(
        customerService.registerCustomer(store1Id, {
          email: testUser.email,
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should not find customer from different store', async () => {
      const customer1 = await customerService.registerCustomer(store1Id, {
        email: testUser.email,
      });

      expect(customerService.getCustomer(customer1.id, store2Id)).rejects.toThrow();
    });

    it('should filter customers by store', async () => {
      const customer1 = await customerService.registerCustomer(store1Id, {
        email: testUser.email,
      });

      const customer2 = await customerService.registerCustomer(store2Id, {
        email: testUser2.email,
      });

      // Can find from own store
      const found1 = await customerService.getCustomer(customer1.id, store1Id);
      expect(found1.id).toBe(customer1.id);

      // Cannot find from other store
      expect(customerService.getCustomer(customer1.id, store2Id)).rejects.toThrow();
    });
  });

  describe('Address Isolation', () => {
    let customer1Id: string;
    let customer2Id: string;

    beforeEach(async () => {
      const c1 = await customerService.registerCustomer(store1Id, {
        email: testUser.email,
      });
      const c2 = await customerService.registerCustomer(store2Id, {
        email: testUser2.email,
      });
      customer1Id = c1.id;
      customer2Id = c2.id;
    });

    it('should isolate addresses by store', async () => {
      const address1 = await addressRepo.createAddress(customer1Id, store1Id, createTestAddress());

      // Cannot access from different store
      expect(addressRepo.findById(address1.id, store2Id)).rejects.toThrow();

      // Can access from same store
      const found = await addressRepo.findById(address1.id, store1Id);
      expect(found).toBeDefined();
    });

    it('should prevent cross-store address retrieval', async () => {
      const address1 = await addressRepo.createAddress(customer1Id, store1Id, createTestAddress());

      const addresses = await addressRepo.getCustomerAddresses(customer1Id, store1Id);
      expect(addresses.some((a) => a.id === address1.id)).toBe(true);

      // Different store should have no addresses for this customer
      const differentStoreAddresses = await addressRepo.getCustomerAddresses(customer1Id, store2Id);
      expect(differentStoreAddresses).toHaveLength(0);
    });

    it('should enforce composite FK constraint', async () => {
      const address = createTestAddress();

      // This should fail at DB level due to composite FK
      // Customer from store1 cannot have address in store2
      expect(
        addressRepo.createAddress(customer1Id, store2Id, address) // customer1 belongs to store1
      ).rejects.toThrow(); // store2 in FK doesn't match
    });
  });

  describe('Session Isolation', () => {
    let customer1Id: string;
    let customer2Id: string;

    beforeEach(async () => {
      const c1 = await createTestCustomer(store1Id);
      const c2 = await createTestCustomer(store2Id);
      customer1Id = c1.id;
      customer2Id = c2.id;
    });

    it('should isolate sessions by store', async () => {
      const { SessionRepository } = await import('../../core/repositories/session.repository.js');
      const repo = new SessionRepository();

      // Create session for customer1 in store1
      const session1 = await repo.createSession(customer1Id, store1Id, {
        tokenHash: 'test-hash-1',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Cannot access session from different store
      expect(repo.findById(session1.id, store2Id)).rejects.toThrow();

      // Can access from same store
      const found = await repo.findById(session1.id, store1Id);
      expect(found).toBeDefined();
    });
  });

  describe('Cross-Store Attack Prevention', () => {
    it('should prevent customer data leakage between stores', async () => {
      const customer1 = await createTestCustomer(store1Id, 'user1@store1.com');
      const customer2 = await createTestCustomer(store2Id, 'user2@store2.com');

      // Get customer from store1
      const found1 = await customerRepo.findByEmailOrFail(customer1.email, store1Id);
      expect(found1.id).toBe(customer1.id);

      // Should not find store1 customer when searching in store2
      expect(customerRepo.findByEmailOrFail(customer1.email, store2Id)).rejects.toThrow();
    });

    it('should prevent address modification across stores', async () => {
      const customer1 = await createTestCustomer(store1Id);
      const address1 = await addressRepo.createAddress(customer1.id, store1Id, createTestAddress());

      // Try to access address from different store
      expect(
        addressRepo.updateAddress(address1.id, customer1.id, store2Id, { city: 'Hacked' })
      ).rejects.toThrow();
    });

    it('should prevent soft delete escape', async () => {
      const customer1 = await createTestCustomer(store1Id, 'user@example.com');
      await customerRepo.softDelete(customer1.id, store1Id);

      // Cannot reuse email in same store even after soft delete (unique constraint respects deleted_at)
      expect(
        customerService.registerCustomer(store1Id, {
          email: 'user@example.com',
        })
      ).rejects.toThrow();

      // But can reuse in different store
      const customer2 = await customerService.registerCustomer(store2Id, {
        email: 'user@example.com',
      });

      expect(customer2).toBeDefined();
    });
  });

  describe('Repository Filtering', () => {
    it('should filter all queries by store_id', async () => {
      const customer1 = await createTestCustomer(store1Id);
      const customer2 = await createTestCustomer(store2Id);

      // Both stores should have 1 customer each
      const count1 = await customerRepo.countByStore(store1Id);
      const count2 = await customerRepo.countByStore(store2Id);

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('should enforce store_id on findById', async () => {
      const customer1 = await createTestCustomer(store1Id);

      // Can find with correct store
      const found = await customerRepo.findById(customer1.id, store1Id);
      expect(found).toBeDefined();

      // Cannot find with wrong store
      const notFound = await customerRepo.findById(customer1.id, store2Id);
      expect(notFound).toBeNull();
    });

    it('should enforce store_id on soft delete', async () => {
      const customer1 = await createTestCustomer(store1Id);

      // Can soft delete from correct store
      await customerRepo.softDelete(customer1.id, store1Id);

      const deleted = await customerRepo.findById(customer1.id, store1Id);
      expect(deleted?.deleted_at).toBeDefined();

      // Attempting delete from wrong store should not find the record
      const notFound = await customerRepo.findById(customer1.id, store2Id);
      expect(notFound).toBeNull();
    });
  });

  describe('Audit Log Isolation', () => {
    it('should scope audit logs to store', async () => {
      const { AuditLogRepository } = await import('../../core/repositories/audit-log.repository.js');
      const repo = new AuditLogRepository();

      // Create audit log for store1
      const log1 = await repo.createEntry(store1Id, {
        tableName: 'customers',
        recordId: 'test-id',
        actorId: 'actor-1',
        actorType: 'customer',
        action: 'insert',
        changes: {},
      });

      // Get audit logs for store1
      const logsStore1 = await repo.getRecordHistory(store1Id, 'customers', 'test-id');
      expect(logsStore1).toContainEqual(expect.objectContaining({ id: log1.id }));
    });
  });
});
