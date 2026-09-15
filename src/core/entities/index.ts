/**
 * Core Domain Entities (26 tables)
 * TypeORM entity definitions for Core Domain v2.1 + Catalog Phase 4 + Orders Phase 5 + Cart Phase 6 + Promos Phase 7 + Shipping Phase 8 + Payments Phase 9
 *
 * Phase 1: Complete
 * Phase 4: Catalog Domain (5 tables)
 * Phase 5: Order Management Domain (2 tables)
 * Phase 6: Cart & Checkout Domain (2 tables)
 * Phase 7: Promotions & Discounts Domain (2 tables)
 * Phase 8: Shipping Integration (2 tables)
 * Phase 9: Payment Processing (2 tables)
 */

// Foundation
export { StoreEntity } from './store.entity.js';
export { StoreSettingsEntity } from './store-settings.entity.js';

// Customer Identity
export { CustomerEntity } from './customer.entity.js';
export { CustomerAddressEntity } from './customer-address.entity.js';
export { CustomerPreferencesEntity } from './customer-preferences.entity.js';
export { CustomerConsentEntity } from './customer-consent.entity.js';

// Authentication
export { CustomerCredentialsEntity } from './customer-credentials.entity.js';
export { SessionEntity } from './session.entity.js';
export { VerificationTokenEntity } from './verification-token.entity.js';
export { PasswordResetTokenEntity } from './password-reset-token.entity.js';

// Audit
export { AuditLogEntity } from './audit-log.entity.js';

// Catalog Domain (Phase 4)
export { ProductEntity } from './product.entity.js';
export { CategoryEntity } from './category.entity.js';
export { ProductVariantEntity } from './product-variant.entity.js';
export { InventoryEntity } from './inventory.entity.js';
export { ProductImageEntity } from './product-image.entity.js';

// Order Management Domain (Phase 5)
export { OrderEntity } from './order.entity.js';
export { OrderLineEntity } from './order-line.entity.js';

// Cart & Checkout Domain (Phase 6)
export { CartEntity } from './cart.entity.js';
export { CartLineEntity } from './cart-line.entity.js';

// Promotions & Discounts Domain (Phase 7)
export { PromoCodeEntity } from './promo-code.entity.js';
export { DiscountApplicationEntity } from './discount-application.entity.js';

// Shipping Integration Domain (Phase 8)
export { ShippingMethodEntity } from './shipping-method.entity.js';
export { ShippingRateEntity } from './shipping-rate.entity.js';

// Payment Processing Domain (Phase 9)
export { PaymentEntity } from './payment.entity.js';
export { RefundEntity } from './refund.entity.js';
