# Phase 3: Routes, Controllers, Middleware & Migrations

**Status:** 📋 PLANNING

**Objective:** Implement HTTP API routes, request handling, middleware, and database migrations for the Core Domain authentication system.

---

## Phase 3 Scope

### A. Middleware (3 files)

#### 1. **JWT Middleware** (`src/core/middleware/jwt.middleware.ts`)
```typescript
export interface JWTPayload {
  customer_id: string;
  store_id: string;
  iat: number;
  exp: number;
}

// Middleware function
export async function requireAuth(req, res, next): Promise<void> {
  const token = extractToken(req.headers.authorization);
  const payload = verifyJWT(token);
  req.customer = { id: payload.customer_id };
  next();
}
```

#### 2. **Store Context Middleware** (Already exists: `src/core/store/store-context.ts`)
- Validates store_id on every request
- Attaches store context to request object
- Verifies store ownership

#### 3. **Error Handler Middleware** (`src/core/middleware/error-handler.middleware.ts`)
```typescript
export function errorHandler(err, req, res, next): void {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toResponse());
  }
  // Handle unexpected errors
  res.status(500).json(ErrorResponse);
}
```

---

### B. Controllers (5 files)

#### 1. **Auth Controller** (`src/core/controllers/auth.controller.ts`)
```typescript
export class AuthController {
  // POST /auth/register
  async register(req, res): Promise<void> {
    const { email, password, firstName, lastName } = req.body;
    const result = await authService.register(storeId, { email, password, firstName, lastName, ipAddress });
    res.status(201).json({ token: result.token, customer: { id: result.customer_id, email } });
  }

  // POST /auth/login
  async login(req, res): Promise<void> {
    const { email, password } = req.body;
    const result = await authService.login(storeId, { email, password, ipAddress });
    res.status(200).json({ token: result.token, customer: { id: result.customer_id, email } });
  }

  // POST /auth/logout
  async logout(req, res): Promise<void> {
    const sessionId = req.session.id; // From JWT payload
    await authService.logout(sessionId, storeId);
    res.status(204).send();
  }

  // POST /auth/logout-everywhere
  async logoutEverywhere(req, res): Promise<void> {
    await authService.logoutEverywhere(customerId, storeId);
    res.status(204).send();
  }
}
```

#### 2. **Customer Controller** (`src/core/controllers/customer.controller.ts`)
```typescript
export class CustomerController {
  // GET /customers/:id
  async getProfile(req, res): Promise<void> {
    const customer = await customerService.getCustomer(customerId, storeId);
    res.json(toDTO(customer));
  }

  // PATCH /customers/:id
  async updateProfile(req, res): Promise<void> {
    const { firstName, lastName, phone } = req.body;
    const customer = await customerService.updateProfile(customerId, storeId, { firstName, lastName, phone });
    res.json(toDTO(customer));
  }

  // DELETE /customers/:id
  async deleteAccount(req, res): Promise<void> {
    await customerService.deleteCustomer(customerId, storeId);
    res.status(204).send();
  }

  // GET /customers/sessions
  async listSessions(req, res): Promise<void> {
    const sessions = await sessionService.listActiveSessions(customerId, storeId);
    res.json(sessions.map(toDTO));
  }
}
```

#### 3. **Email Verification Controller** (`src/core/controllers/email-verification.controller.ts`)
```typescript
export class EmailVerificationController {
  // POST /email-verification/send
  async sendVerification(req, res): Promise<void> {
    const token = await authService.sendEmailVerification(customerId, storeId);
    // Send email with token
    res.status(200).json({ message: 'Verification email sent' });
  }

  // POST /email-verification/verify
  async verifyEmail(req, res): Promise<void> {
    const { token } = req.body;
    await authService.verifyEmail(token, storeId);
    res.status(200).json({ message: 'Email verified successfully' });
  }
}
```

#### 4. **Password Controller** (`src/core/controllers/password.controller.ts`)
```typescript
export class PasswordController {
  // POST /password/forgot
  async requestReset(req, res): Promise<void> {
    const { email } = req.body;
    await authService.sendPasswordReset(email, storeId, ipAddress);
    res.status(200).json({ message: 'Reset email sent if account exists' });
  }

  // POST /password/reset
  async resetPassword(req, res): Promise<void> {
    const { token, password } = req.body;
    await authService.resetPassword(token, password, storeId, ipAddress);
    res.status(200).json({ message: 'Password reset successfully' });
  }

  // POST /password/change
  async changePassword(req, res): Promise<void> {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(customerId, storeId, currentPassword, newPassword);
    res.status(200).json({ message: 'Password changed successfully' });
  }
}
```

#### 5. **Address Controller** (`src/core/controllers/address.controller.ts`)
```typescript
export class AddressController {
  // GET /addresses
  async listAddresses(req, res): Promise<void> {
    const addresses = await addressRepository.getCustomerAddresses(customerId, storeId);
    res.json(addresses.map(toDTO));
  }

  // POST /addresses
  async createAddress(req, res): Promise<void> {
    const address = await addressRepository.createAddress(customerId, storeId, req.body);
    res.status(201).json(toDTO(address));
  }

  // PATCH /addresses/:id
  async updateAddress(req, res): Promise<void> {
    const address = await addressRepository.updateAddress(addressId, customerId, storeId, req.body);
    res.json(toDTO(address));
  }

  // DELETE /addresses/:id
  async deleteAddress(req, res): Promise<void> {
    await addressRepository.softDelete(addressId, storeId);
    res.status(204).send();
  }

  // POST /addresses/:id/set-default-shipping
  async setDefaultShipping(req, res): Promise<void> {
    await addressRepository.setDefaultShippingAddress(addressId, customerId, storeId);
    res.status(200).json({ message: 'Default shipping address updated' });
  }

  // POST /addresses/:id/set-default-billing
  async setDefaultBilling(req, res): Promise<void> {
    await addressRepository.setDefaultBillingAddress(addressId, customerId, storeId);
    res.status(200).json({ message: 'Default billing address updated' });
  }
}
```

---

### C. Routes (5 files)

#### 1. **Auth Routes** (`src/core/routes/auth.routes.ts`)
```
POST   /auth/register                    → AuthController.register()
POST   /auth/login                       → AuthController.login()
POST   /auth/logout                      → [requireAuth] AuthController.logout()
POST   /auth/logout-everywhere           → [requireAuth] AuthController.logoutEverywhere()
```

#### 2. **Customer Routes** (`src/core/routes/customer.routes.ts`)
```
GET    /customers/:id                    → [requireAuth] CustomerController.getProfile()
PATCH  /customers/:id                    → [requireAuth] CustomerController.updateProfile()
DELETE /customers/:id                    → [requireAuth] CustomerController.deleteAccount()
GET    /customers/sessions               → [requireAuth] CustomerController.listSessions()
```

#### 3. **Email Verification Routes** (`src/core/routes/email-verification.routes.ts`)
```
POST   /email-verification/send          → [requireAuth] EmailVerificationController.sendVerification()
POST   /email-verification/verify        → EmailVerificationController.verifyEmail()
```

#### 4. **Password Routes** (`src/core/routes/password.routes.ts`)
```
POST   /password/forgot                  → PasswordController.requestReset()
POST   /password/reset                   → PasswordController.resetPassword()
POST   /password/change                  → [requireAuth] PasswordController.changePassword()
```

#### 5. **Address Routes** (`src/core/routes/address.routes.ts`)
```
GET    /addresses                        → [requireAuth] AddressController.listAddresses()
POST   /addresses                        → [requireAuth] AddressController.createAddress()
PATCH  /addresses/:id                    → [requireAuth] AddressController.updateAddress()
DELETE /addresses/:id                    → [requireAuth] AddressController.deleteAddress()
POST   /addresses/:id/set-default-shipping → [requireAuth] AddressController.setDefaultShipping()
POST   /addresses/:id/set-default-billing  → [requireAuth] AddressController.setDefaultBilling()
```

#### 6. **Main Router** (`src/core/routes/index.ts`)
```typescript
export function createCoreRoutes(app: Express): void {
  const router = Router();
  
  router.use('/auth', authRoutes);
  router.use('/customers', customerRoutes);
  router.use('/email-verification', emailVerificationRoutes);
  router.use('/password', passwordRoutes);
  router.use('/addresses', addressRoutes);
  
  app.use('/api/v1', storeContextMiddleware, router);
}
```

---

### D. Request/Response DTOs (5 files)

#### 1. **Auth DTOs** (`src/core/dto/auth.dto.ts`)
```typescript
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
  customer: { id: string; email: string };
}
```

#### 2. **Customer DTOs** (`src/core/dto/customer.dto.ts`)
```typescript
export interface CustomerProfileDTO {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}
```

#### 3. **Address DTOs** (`src/core/dto/address.dto.ts`)
```typescript
export interface AddressDTO {
  id: string;
  type: 'shipping' | 'billing';
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}
```

#### 4. **Password DTOs** (`src/core/dto/password.dto.ts`)
```typescript
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}
```

#### 5. **Session DTOs** (`src/core/dto/session.dto.ts`)
```typescript
export interface SessionDTO {
  id: string;
  deviceType?: string;
  deviceName?: string;
  ipAddress: string;
  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
}
```

---

### E. Database Migrations (11 files)

#### 1. **Create Stores Table**
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  domain VARCHAR(255) UNIQUE,
  owner_email VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_domain ON stores(domain);
CREATE INDEX idx_stores_status ON stores(status);
```

#### 2. **Create Store Settings Table**
```sql
CREATE TABLE store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID UNIQUE NOT NULL REFERENCES stores ON DELETE CASCADE,
  default_currency VARCHAR(3) DEFAULT 'USD',
  default_timezone VARCHAR(50) DEFAULT 'UTC',
  default_locale VARCHAR(10) DEFAULT 'en-US',
  guest_checkout_enabled BOOLEAN DEFAULT true,
  customer_accounts_enabled BOOLEAN DEFAULT true,
  email_verification_required BOOLEAN DEFAULT true,
  order_confirmation_email BOOLEAN DEFAULT true,
  order_shipped_email BOOLEAN DEFAULT true,
  inventory_tracking_enabled BOOLEAN DEFAULT true,
  low_stock_alert_enabled BOOLEAN DEFAULT false,
  tax_calculation_enabled BOOLEAN DEFAULT false,
  maintenance_mode BOOLEAN DEFAULT false,
  settings_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. **Create Customers Table** (with composite PK)
```sql
CREATE TABLE customers (
  id UUID NOT NULL,
  store_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  email_normalized VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  email_verified BOOLEAN DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  PRIMARY KEY (id, store_id),
  FOREIGN KEY (store_id) REFERENCES stores ON DELETE RESTRICT
);

CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_store_status ON customers(store_id, status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE UNIQUE INDEX idx_customers_email_normalized_active 
  ON customers(store_id, email_normalized) 
  WHERE deleted_at IS NULL;
```

#### 4-11. **Create Child Tables** (8 more files)
- customer_addresses
- customer_preferences
- customer_consent (with trigger: prevent_customer_consent_mutation)
- customer_credentials
- sessions
- verification_tokens
- password_reset_tokens
- audit_logs (with trigger: prevent_audit_log_mutation)

---

### F. Integration Tests (8 files)

#### Test Categories:
1. **Auth Flow Tests** (`__tests__/integration/auth-flow.test.ts`)
   - Register → Verify Email → Login → Logout
   - Register → Forgot Password → Reset → Login
   - Brute-force protection (5 failed attempts)

2. **Store Isolation Tests** (`__tests__/integration/store-isolation.test.ts`)
   - Verify customer from Store A cannot access Store B data
   - Verify address from Store A cannot be modified by Store B
   - Verify session tokens are store-specific

3. **Token Security Tests** (`__tests__/integration/token-security.test.ts`)
   - Session token hashing
   - Verification token one-time use
   - Password reset token brute-force limit

4. **Soft Delete Tests** (`__tests__/integration/soft-delete.test.ts`)
   - Soft delete customer
   - Soft delete address
   - Restore customer with cascading restore

5. **Immutability Tests** (`__tests__/integration/immutability.test.ts`)
   - Audit logs cannot be updated
   - Consent records cannot be modified
   - Attempting to update throws error

6. **Preferences Tests** (`__tests__/integration/preferences.test.ts`)
   - Email preferences isolation
   - SMS opt-in/out
   - Localization settings

7. **Address Management Tests** (`__tests__/integration/address-management.test.ts`)
   - Create multiple addresses
   - Set default shipping/billing
   - Soft delete and restore

8. **Error Handling Tests** (`__tests__/integration/error-handling.test.ts`)
   - Invalid credentials
   - Expired tokens
   - Store isolation violations

---

## Deliverables Checklist

### Middleware
- [ ] JWT middleware with token validation
- [ ] Error handler middleware
- [ ] Request validation middleware (optional)

### Controllers
- [ ] AuthController (register, login, logout)
- [ ] CustomerController (profile, sessions)
- [ ] EmailVerificationController
- [ ] PasswordController (forgot, reset, change)
- [ ] AddressController

### Routes
- [ ] Auth routes
- [ ] Customer routes
- [ ] Email verification routes
- [ ] Password routes
- [ ] Address routes
- [ ] Main router setup

### DTOs
- [ ] Auth DTOs
- [ ] Customer DTOs
- [ ] Address DTOs
- [ ] Password DTOs
- [ ] Session DTOs

### Database Migrations
- [ ] Create stores table
- [ ] Create store_settings table
- [ ] Create customers table
- [ ] Create customer_addresses table
- [ ] Create customer_preferences table
- [ ] Create customer_consent table with trigger
- [ ] Create customer_credentials table
- [ ] Create sessions table
- [ ] Create verification_tokens table
- [ ] Create password_reset_tokens table
- [ ] Create audit_logs table with trigger

### Integration Tests
- [ ] Auth flow tests
- [ ] Store isolation tests
- [ ] Token security tests
- [ ] Soft delete tests
- [ ] Immutability tests
- [ ] Preferences tests
- [ ] Address management tests
- [ ] Error handling tests

---

## Dependencies for Phase 3

### External Libraries
```json
{
  "bcryptjs": "^2.4.3",      // Password hashing (already added)
  "express": "^4.18.2",      // HTTP framework
  "jsonwebtoken": "^9.0.0",  // JWT tokens
  "joi": "^17.9.2",          // Request validation
  "helmet": "^7.0.0",        // Security headers
  "cors": "^2.8.5"           // CORS handling
}
```

### From Phase 0-2
- ✅ TypeORM (entities, repositories)
- ✅ PostgreSQL driver
- ✅ Zod (configuration validation)
- ✅ Winston (logging)
- ✅ Error classes
- ✅ Store context middleware

---

## Phase 3 Architecture

```
Request
  ↓
CORS Middleware
  ↓
Store Context Middleware (validates store_id)
  ↓
Routes
  ↓
Controllers (orchestrate services)
  ↓
Services (business logic)
  ↓
Repositories (data access)
  ↓
TypeORM → PostgreSQL
  ↓
Response (DTO)
  ↓
Error Handler Middleware (catch errors)
```

---

## Estimated Effort

- **Controllers:** 2-3 hours
- **Routes:** 1-2 hours
- **DTOs:** 1 hour
- **Middleware:** 1-2 hours
- **Migrations:** 2-3 hours
- **Integration Tests:** 3-4 hours
- **Documentation:** 1 hour

**Total:** 11-16 hours implementation + testing

---

## Success Criteria

- [ ] All routes respond with correct HTTP status codes
- [ ] Store isolation enforced (cross-store access blocked)
- [ ] Tokens secure (hashes only, no raw tokens)
- [ ] Account lockout works (5 failures, 15 min)
- [ ] Email verification flow complete
- [ ] Password reset with brute-force protection
- [ ] All tests pass (integration + unit)
- [ ] Error responses follow standard format
- [ ] Migrations run successfully
- [ ] No plaintext secrets in responses
- [ ] JWT tokens issued with correct payload
- [ ] Session management multi-device support

---

## Phase 4: Catalog Domain (Post-Phase 3)

Once Phase 3 is complete and tested:
1. Design Catalog v2.0 (products, categories, SKUs, inventory)
2. Implement Catalog repositories and services
3. Implement Catalog routes and controllers
4. Create migrations for catalog tables
5. Integration tests for catalog operations

**Catalog v2.0 will follow same patterns:**
- Composite FKs with store_id
- Soft delete for products
- Audit logging for price/inventory changes
- Store-specific product filtering
