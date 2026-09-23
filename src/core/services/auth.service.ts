/**
 * Auth Service
 * Authentication workflow orchestration
 *
 * Phase 2: Service implementation
 */

import bcrypt from 'bcryptjs';
import { CustomerService } from './customer.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { CustomerRepository } from '../repositories/customer.repository';
import { CustomerCredentialsRepository } from '../repositories/customer-credentials.repository';
import { CustomerPreferencesRepository } from '../repositories/customer-preferences.repository';
import { CustomerConsentRepository } from '../repositories/customer-consent.repository';
import { SessionEntity } from '../entities/session.entity';
import { ValidationError, AuthenticationError, ConflictError } from '../errors/app-error';
import { generateToken } from '../utils/jwt.util';

export interface LoginResponse {
  customer_id: string;
  email: string;
  token: string;
  session: SessionEntity;
}

export class AuthService {
  private customerService: CustomerService;
  private sessionService: SessionService;
  private tokenService: TokenService;
  private customerRepo: CustomerRepository;
  private credentialsRepo: CustomerCredentialsRepository;
  private preferencesRepo: CustomerPreferencesRepository;
  private consentRepo: CustomerConsentRepository;

  constructor() {
    this.customerService = new CustomerService();
    this.sessionService = new SessionService();
    this.tokenService = new TokenService();
    this.customerRepo = new CustomerRepository();
    this.credentialsRepo = new CustomerCredentialsRepository();
    this.preferencesRepo = new CustomerPreferencesRepository();
    this.consentRepo = new CustomerConsentRepository();
  }

  // ============================================================================
  // Registration
  // ============================================================================

  /**
   * Register new customer with password
   */
  async register(
    storeId: string,
    data: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      ipAddress: string;
      userAgent?: string;
    }
  ): Promise<LoginResponse> {
    // Validate password strength
    if (!data.password || data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Register customer
    const customer = await this.customerService.registerCustomer(storeId, {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
    });

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create credentials
    await this.credentialsRepo.createCredentials(customer.id, storeId, passwordHash);

    // Create default preferences
    await this.preferencesRepo.createDefaults(customer.id, storeId);

    // Create session
    const { session, token: rawToken } = await this.sessionService.createSession(customer.id, storeId, {
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    // Generate JWT token for API authentication
    const jwtToken = generateToken(customer.id, storeId, session.id);

    return {
      customer_id: customer.id,
      email: customer.email,
      token: jwtToken,
      session,
    };
  }

  // ============================================================================
  // Login/Logout
  // ============================================================================

  /**
   * Login with email and password
   */
  async login(
    storeId: string,
    data: {
      email: string;
      password: string;
      ipAddress: string;
      userAgent?: string;
    }
  ): Promise<LoginResponse> {
    // Get customer by email
    const customer = await this.customerRepo.findByEmail(data.email, storeId);
    if (!customer) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Get credentials
    const credentials = await this.credentialsRepo.getByCustomerId(customer.id, storeId);
    if (!credentials) {
      throw new AuthenticationError('Customer not configured for login');
    }

    // Check if account is locked
    const isLocked = await this.credentialsRepo.isAccountLocked(customer.id, storeId);
    if (isLocked) {
      throw new AuthenticationError('Account is temporarily locked');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, credentials.password_hash);
    if (!isValidPassword) {
      await this.credentialsRepo.recordLoginFailure(customer.id, storeId);
      throw new AuthenticationError('Invalid email or password');
    }

    // Record successful login
    await this.credentialsRepo.recordLoginSuccess(customer.id, storeId);

    // Create session
    const { session, token: rawToken } = await this.sessionService.createSession(customer.id, storeId, {
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    // Generate JWT token for API authentication
    const jwtToken = generateToken(customer.id, storeId, session.id);

    return {
      customer_id: customer.id,
      email: customer.email,
      token: jwtToken,
      session,
    };
  }

  /**
   * Logout (revoke single session)
   */
  async logout(sessionId: string, storeId: string): Promise<void> {
    await this.sessionService.logout(sessionId, storeId);
  }

  /**
   * Logout everywhere (revoke all sessions)
   */
  async logoutEverywhere(customerId: string, storeId: string): Promise<void> {
    await this.sessionService.logoutEverywhere(customerId, storeId);
  }

  /**
   * Verify session token
   */
  async verifySession(token: string, storeId: string): Promise<SessionEntity> {
    return this.sessionService.verifySession(token, storeId);
  }

  // ============================================================================
  // Email Verification
  // ============================================================================

  /**
   * Send email verification token
   */
  async sendEmailVerification(customerId: string, storeId: string): Promise<string> {
    const customer = await this.customerRepo.findByIdOrFail(customerId, storeId);

    const { token } = await this.tokenService.createVerificationToken(
      customerId,
      storeId,
      customer.email
    );

    // TODO: Send email with token via email service

    return token;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string, storeId: string): Promise<void> {
    const tokenEntity = await this.tokenService.verifyEmailToken(token, storeId);

    // Mark customer email as verified
    await this.customerService.verifyEmail(tokenEntity.customer_id, storeId);
  }

  // ============================================================================
  // Password Reset
  // ============================================================================

  /**
   * Send password reset token
   */
  async sendPasswordReset(email: string, storeId: string, ipAddress: string): Promise<string> {
    const customer = await this.customerRepo.findByEmail(email, storeId);

    if (!customer) {
      // Don't reveal if email exists (security best practice)
      return '';
    }

    const { token } = await this.tokenService.createPasswordResetToken(
      customer.id,
      storeId,
      email,
      ipAddress
    );

    // TODO: Send email with token via email service

    return token;
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    storeId: string,
    usedIp: string
  ): Promise<void> {
    const tokenEntity = await this.tokenService.verifyPasswordResetToken(token, storeId);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.credentialsRepo.updatePassword(tokenEntity.customer_id, storeId, passwordHash);

    // Consume token
    await this.tokenService.consumePasswordResetToken(token, storeId, usedIp);
  }

  // ============================================================================
  // Password Change
  // ============================================================================

  /**
   * Change password (while logged in)
   */
  async changePassword(
    customerId: string,
    storeId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get credentials
    const credentials = await this.credentialsRepo.getByCustomerId(customerId, storeId);
    if (!credentials) {
      throw new ValidationError('Customer not configured for password change');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, credentials.password_hash);
    if (!isValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.credentialsRepo.updatePassword(customerId, storeId, passwordHash);

    // Logout everywhere on password change (security best practice)
    await this.logoutEverywhere(customerId, storeId);
  }
}
