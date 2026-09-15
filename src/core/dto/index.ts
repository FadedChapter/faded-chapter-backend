/**
 * DTO Barrel Export
 * Centralized import point for all DTOs
 */

export * from './auth.dto';
export * from './customer.dto';
export * from './address.dto';
export * from './preferences.dto';
export * from './payment.dto';

// NOTE: this directory (`dto/`) holds RESPONSE shapes — what the API returns.
// The similarly named `dtos/` directory holds REQUEST/input shapes
// (CreatePaymentIntentDto, etc.). The two are easy to confuse; consolidating
// them is worth doing, but is a rename that touches many imports and so is
// deliberately left out of the Phase 0 security work.
