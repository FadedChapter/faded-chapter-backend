/**
 * Repository Barrel Export
 * Centralized import point for all repositories
 */

export { BaseRepository } from '../repository/base-repository';
export { CustomerRepository } from './customer.repository';
export { SessionRepository } from './session.repository';
export { VerificationTokenRepository, PasswordResetTokenRepository } from './token.repository';
export { AuditLogRepository } from './audit-log.repository';
export { CustomerAddressRepository } from './customer-address.repository';
export { CustomerCredentialsRepository } from './customer-credentials.repository';
export { CustomerConsentRepository } from './customer-consent.repository';
export { CustomerPreferencesRepository } from './customer-preferences.repository';
