/**
 * Auth DTOs
 * Request and response models for authentication endpoints
 *
 * Phase 3: API Layer
 */

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface LogoutResponse {
  message: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}
