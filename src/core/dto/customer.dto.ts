/**
 * Customer DTOs
 * Request and response models for customer endpoints
 *
 * Phase 3: API Layer
 */

export interface CustomerProfileDTO {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface SessionDTO {
  id: string;
  deviceType: string | null;
  deviceName: string | null;
  ipAddress: string;
  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface ListSessionsResponse {
  sessions: SessionDTO[];
}

export interface DeleteAccountRequest {
  password: string;
}
