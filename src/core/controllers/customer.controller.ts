/**
 * Customer Controller
 * Handles customer profile endpoints
 *
 * Phase 3: API Layer
 */

import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';
import { SessionService } from '../services/session.service';
import { CustomerProfileDTO, UpdateProfileRequest, SessionDTO, ListSessionsResponse } from '../dto/index';
import { ValidationError } from '../errors/app-error';

export class CustomerController {
  private customerService: CustomerService;
  private sessionService: SessionService;

  constructor() {
    this.customerService = new CustomerService();
    this.sessionService = new SessionService();
  }

  /**
   * Get customer profile
   * GET /customers/me
   * Requires: Authentication
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    const customer = await this.customerService.getCustomer(customerId, storeId);

    const response: CustomerProfileDTO = {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      emailVerified: customer.email_verified,
      status: customer.status,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };

    res.status(200).json(response);
  }

  /**
   * Update customer profile
   * PATCH /customers/me
   * Requires: Authentication
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;
    const body: UpdateProfileRequest = req.body;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    if (!body.firstName && !body.lastName && !body.phone) {
      throw new ValidationError('At least one field must be provided');
    }

    const updated = await this.customerService.updateProfile(customerId, storeId, {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
    });

    const response: CustomerProfileDTO = {
      id: updated.id,
      email: updated.email,
      firstName: updated.first_name,
      lastName: updated.last_name,
      phone: updated.phone,
      emailVerified: updated.email_verified,
      status: updated.status,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };

    res.status(200).json(response);
  }

  /**
   * List active sessions
   * GET /customers/sessions
   * Requires: Authentication
   */
  async listSessions(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const customerId = req.customerId;

    if (!customerId) {
      throw new ValidationError('Customer not found');
    }

    const sessions = await this.sessionService.listActiveSessions(customerId, storeId);

    const sessionDTOs: SessionDTO[] = sessions.map((session) => ({
      id: session.id,
      deviceType: session.device_type,
      deviceName: session.device_name,
      ipAddress: session.ip_address,
      lastActivityAt: session.last_activity_at,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
    }));

    const response: ListSessionsResponse = {
      sessions: sessionDTOs,
    };

    res.status(200).json(response);
  }

  /**
   * Revoke a session
   * DELETE /customers/sessions/:sessionId
   * Requires: Authentication
   */
  async revokeSession(req: Request, res: Response): Promise<void> {
    const storeId = req.storeId;
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ValidationError('Session ID is required');
    }

    await this.sessionService.logout(sessionId, storeId);

    res.status(200).json({
      message: 'Session revoked',
    });
  }
}
