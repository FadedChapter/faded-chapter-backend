/**
 * Auth Controller
 * Handles authentication endpoints (register, login, logout)
 *
 * Phase 3: API Layer
 */

import { Request, Response } from 'express';
import { AuthService } from '../services/index';
import {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  VerifyEmailRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../dto/index';
import { ValidationError } from '../errors/app-error';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register new customer
   * POST /auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const ipAddress = req.ip || 'unknown';

    const body: RegisterRequest = req.body;

    // Validate required fields
    if (!body.email || !body.password) {
      throw new ValidationError('Email and password are required');
    }

    // Validate password strength (at least 8 characters)
    if (body.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    const result = await this.authService.register(storeId, {
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      ipAddress,
      userAgent: req.get('user-agent'),
    });

    const response: LoginResponse = {
      token: result.token,
      customer: {
        id: result.customer_id,
        email: result.email,
        firstName: null,
        lastName: null,
      },
    };

    res.status(201).json(response);
  }

  /**
   * Login with email and password
   * POST /auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const ipAddress = req.ip || 'unknown';

    const body: LoginRequest = req.body;

    if (!body.email || !body.password) {
      throw new ValidationError('Email and password are required');
    }

    const result = await this.authService.login(storeId, {
      email: body.email,
      password: body.password,
      ipAddress,
      userAgent: req.get('user-agent'),
    });

    const response: LoginResponse = {
      token: result.token,
      customer: {
        id: result.customer_id,
        email: result.email,
        firstName: null,
        lastName: null,
      },
    };

    res.status(200).json(response);
  }

  /**
   * Logout (revoke current session)
   * POST /auth/logout
   * Requires: Authentication
   */
  async logout(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const sessionId = req.sessionId;

    if (!sessionId) {
      throw new ValidationError('Session not found');
    }

    await this.authService.logout(sessionId, storeId);

    const response: LogoutResponse = {
      message: 'Logged out successfully',
    };

    res.status(200).json(response);
  }

  /**
   * Logout everywhere (revoke all sessions)
   * POST /auth/logout-everywhere
   * Requires: Authentication
   */
  async logoutEverywhere(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    await this.authService.logoutEverywhere(customerId, storeId);

    const response: LogoutResponse = {
      message: 'Logged out from all devices',
    };

    res.status(200).json(response);
  }

  /**
   * Send email verification token
   * POST /email-verification/send
   * Requires: Authentication
   */
  async sendEmailVerification(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    await this.authService.sendEmailVerification(customerId, storeId);

    res.status(200).json({
      message: 'Verification email sent',
    });
  }

  /**
   * Verify email with token
   * POST /email-verification/verify
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const body: VerifyEmailRequest = req.body;

    if (!body.token) {
      throw new ValidationError('Token is required');
    }

    await this.authService.verifyEmail(body.token, storeId);

    res.status(200).json({
      message: 'Email verified successfully',
    });
  }

  /**
   * Request password reset
   * POST /password/forgot
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const ipAddress = req.ip || 'unknown';
    const body: ForgotPasswordRequest = req.body;

    if (!body.email) {
      throw new ValidationError('Email is required');
    }

    await this.authService.sendPasswordReset(body.email, storeId, ipAddress);

    // Don't reveal if email exists (security best practice)
    res.status(200).json({
      message: 'If an account exists with this email, a reset link will be sent',
    });
  }

  /**
   * Reset password with token
   * POST /password/reset
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const ipAddress = req.ip || 'unknown';
    const body: ResetPasswordRequest = req.body;

    if (!body.token || !body.password) {
      throw new ValidationError('Token and password are required');
    }

    if (body.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    await this.authService.resetPassword(body.token, body.password, storeId, ipAddress);

    res.status(200).json({
      message: 'Password reset successfully',
    });
  }

  /**
   * Change password (while logged in)
   * POST /password/change
   * Requires: Authentication
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: ChangePasswordRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!body.currentPassword || !body.newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    if (body.newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    if (body.currentPassword === body.newPassword) {
      throw new ValidationError('New password must be different from current password');
    }

    await this.authService.changePassword(
      customerId,
      storeId,
      body.currentPassword,
      body.newPassword
    );

    res.status(200).json({
      message: 'Password changed successfully. Please log in again.',
    });
  }
}
