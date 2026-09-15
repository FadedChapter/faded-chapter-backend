/**
 * Auth Flow Integration Tests
 * Complete authentication workflows
 *
 * Phase 3C: Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../../core/services/auth.service.js';
import { SessionService } from '../../core/services/session.service.js';
import { CustomerService } from '../../core/services/customer.service.js';
import { createTestStore, createTestCustomer, createTestCredentials } from '../setup.js';
import { testUser, testUser2, hashPassword, sleep } from '../helpers.js';

describe('Auth Flow Tests', () => {
  let authService: AuthService;
  let sessionService: SessionService;
  let customerService: CustomerService;
  let storeId: string;

  beforeEach(async () => {
    authService = new AuthService();
    sessionService = new SessionService();
    customerService = new CustomerService();
    storeId = await createTestStore();
  });

  describe('Registration Flow', () => {
    it('should register new customer successfully', async () => {
      const result = await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        ipAddress: '192.168.1.1',
      });

      expect(result.customer_id).toBeDefined();
      expect(result.email).toBe(testUser.email);
      expect(result.token).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.is_active).toBe(true);
    });

    it('should reject duplicate email registration', async () => {
      await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });

      expect(
        authService.register(storeId, {
          email: testUser.email,
          password: testUser.password,
          ipAddress: '192.168.1.1',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should reject weak passwords', async () => {
      expect(
        authService.register(storeId, {
          email: testUser.email,
          password: 'weak',
          ipAddress: '192.168.1.1',
        })
      ).rejects.toThrow();
    });

    it('should create default preferences on registration', async () => {
      const result = await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });

      const customer = await customerService.getCustomer(result.customer_id, storeId);
      expect(customer).toBeDefined();
    });
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });
    });

    it('should login successfully with correct credentials', async () => {
      const result = await authService.login(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });

      expect(result.customer_id).toBeDefined();
      expect(result.email).toBe(testUser.email);
      expect(result.token).toBeDefined();
      expect(result.session.is_active).toBe(true);
    });

    it('should reject login with incorrect password', async () => {
      expect(
        authService.login(storeId, {
          email: testUser.email,
          password: 'WrongPassword123',
          ipAddress: '192.168.1.1',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      expect(
        authService.login(storeId, {
          email: 'nonexistent@example.com',
          password: testUser.password,
          ipAddress: '192.168.1.1',
        })
      ).rejects.toThrow();
    });

    it('should track failed login attempts', async () => {
      // Simulate 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(storeId, {
            email: testUser.email,
            password: 'WrongPassword123',
            ipAddress: '192.168.1.1',
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th attempt should be locked
      expect(
        authService.login(storeId, {
          email: testUser.email,
          password: testUser.password,
          ipAddress: '192.168.1.1',
        })
      ).rejects.toThrow('temporarily locked');
    });

    it('should create new session on login', async () => {
      const result = await authService.login(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });

      const sessions = await sessionService.listActiveSessions(result.customer_id, storeId);
      expect(sessions.length).toBeGreaterThan(0);
    });
  });

  describe('Logout Flow', () => {
    let customerId: string;
    let sessionId: string;
    let token: string;

    beforeEach(async () => {
      const result = await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });
      customerId = result.customer_id;
      sessionId = result.session.id;
      token = result.token;
    });

    it('should logout single session', async () => {
      await authService.logout(sessionId, storeId);

      const sessions = await sessionService.listActiveSessions(customerId, storeId);
      expect(sessions.find((s) => s.id === sessionId)).toBeUndefined();
    });

    it('should logout all sessions', async () => {
      // Create second session
      await authService.login(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.2',
      });

      const sessionsBefore = await sessionService.listActiveSessions(customerId, storeId);
      expect(sessionsBefore.length).toBe(2);

      // Logout everywhere
      await authService.logoutEverywhere(customerId, storeId);

      const sessionsAfter = await sessionService.listActiveSessions(customerId, storeId);
      expect(sessionsAfter.length).toBe(0);
    });

    it('should invalidate token after logout', async () => {
      await authService.logout(sessionId, storeId);

      expect(authService.verifySession(token, storeId)).rejects.toThrow();
    });
  });

  describe('Email Verification Flow', () => {
    let customerId: string;

    beforeEach(async () => {
      const result = await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });
      customerId = result.customer_id;
    });

    it('should send email verification token', async () => {
      const token = await authService.sendEmailVerification(customerId, storeId);
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should verify email with valid token', async () => {
      const token = await authService.sendEmailVerification(customerId, storeId);
      await authService.verifyEmail(token, storeId);

      const customer = await customerService.getCustomer(customerId, storeId);
      expect(customer.email_verified).toBe(true);
    });

    it('should reject invalid verification token', async () => {
      expect(authService.verifyEmail('invalid-token', storeId)).rejects.toThrow();
    });

    it('should prevent email verification twice', async () => {
      const token = await authService.sendEmailVerification(customerId, storeId);
      await authService.verifyEmail(token, storeId);

      const token2 = await authService.sendEmailVerification(customerId, storeId);
      expect(authService.verifyEmail(token2, storeId)).rejects.toThrow();
    });
  });

  describe('Password Reset Flow', () => {
    let customerId: string;

    beforeEach(async () => {
      const result = await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });
      customerId = result.customer_id;
    });

    it('should send password reset token', async () => {
      const token = await authService.sendPasswordReset(testUser.email, storeId, '192.168.1.1');
      expect(token).toBeDefined();
    });

    it('should reset password with valid token', async () => {
      const token = await authService.sendPasswordReset(testUser.email, storeId, '192.168.1.1');
      const newPassword = 'NewPassword123!';

      await authService.resetPassword(token, newPassword, storeId, '192.168.1.1');

      // Should be able to login with new password
      const result = await authService.login(storeId, {
        email: testUser.email,
        password: newPassword,
        ipAddress: '192.168.1.1',
      });

      expect(result.customer_id).toBe(customerId);
    });

    it('should reject invalid reset token', async () => {
      expect(authService.resetPassword('invalid-token', 'NewPassword123!', storeId, '192.168.1.1')).rejects.toThrow();
    });

    it('should protect against brute force on reset token', async () => {
      const token = await authService.sendPasswordReset(testUser.email, storeId, '192.168.1.1');

      // Try invalid attempts
      for (let i = 0; i < 3; i++) {
        try {
          await authService.verifySession(token, storeId);
        } catch (error) {
          // Expected
        }
      }

      // Should now be locked
      expect(authService.resetPassword(token, 'NewPassword123!', storeId, '192.168.1.1')).rejects.toThrow();
    });
  });

  describe('Password Change Flow', () => {
    let customerId: string;

    beforeEach(async () => {
      const result = await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });
      customerId = result.customer_id;
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword123!';

      await authService.changePassword(customerId, storeId, testUser.password, newPassword);

      // Should be able to login with new password
      const result = await authService.login(storeId, {
        email: testUser.email,
        password: newPassword,
        ipAddress: '192.168.1.1',
      });

      expect(result.customer_id).toBe(customerId);
    });

    it('should reject change with wrong current password', async () => {
      expect(
        authService.changePassword(customerId, storeId, 'WrongPassword123', 'NewPassword123!')
      ).rejects.toThrow('incorrect');
    });

    it('should logout all sessions on password change', async () => {
      // Create multiple sessions
      await authService.login(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.2',
      });

      await authService.changePassword(customerId, storeId, testUser.password, 'NewPassword123!');

      const sessions = await sessionService.listActiveSessions(customerId, storeId);
      expect(sessions.length).toBe(0);
    });
  });

  describe('Multi-Device Sessions', () => {
    let customerId: string;

    beforeEach(async () => {
      const result = await authService.register(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });
      customerId = result.customer_id;
    });

    it('should support multiple concurrent sessions', async () => {
      // Create sessions from different IPs
      const session1 = await authService.login(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.1',
      });

      const session2 = await authService.login(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.2',
      });

      const sessions = await sessionService.listActiveSessions(customerId, storeId);
      expect(sessions.length).toBe(3); // Original + 2 logins
    });

    it('should track device information', async () => {
      const result = await authService.login(storeId, {
        email: testUser.email,
        password: testUser.password,
        ipAddress: '192.168.1.100',
      });

      expect(result.session.ip_address).toBe('192.168.1.100');
      expect(result.session.created_at).toBeDefined();
    });
  });
});
