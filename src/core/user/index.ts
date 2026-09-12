/**
 * User Module Public API
 */

export type { UserRecord, AuthenticatedUserData, CreateUserInput } from './user.types';
export type { UserStore } from './user-store.port';
export { USER_STORE } from './user-store.port';

export { InMemoryUserStore } from './adapters/inmemory-user-store';

export { hashPassword, verifyPassword } from './services/password-hashing.service';
export { normalizeEmail, isValidEmail } from './utils/email.util';
