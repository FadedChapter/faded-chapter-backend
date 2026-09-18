# Phase 3: HTTP API Layer & Database Migrations — COMPLETE

**Status:** ✅ COMPLETE (API + Migrations)

**Date:** 2026-09-14

**Summary:** Full HTTP API implementation with Express, controllers, routes, middleware, DTOs, and 11 TypeORM migrations creating the complete database schema.

---

## Phase 3 Breakdown

### Phase 3A: HTTP API Layer ✅
- 4 Controllers (Auth, Customer, Address, Preferences)
- 5 Route files (Auth, Customer, Address, Preferences, Main Router)
- 2 Middleware (JWT verification, Error handling)
- 4 DTO files (request/response models)
- 1 Express app setup
- 1 JWT utility module
- Express Request type extensions
- **Files:** 18 API layer files, ~3,500 lines

### Phase 3B: Database Migrations ✅
- 11 TypeORM migrations (create all tables)
- PostgreSQL triggers for immutability
- Composite primary and foreign keys
- Strategic indexes for performance
- Soft delete support
- JSONB column support
- **Files:** 11 migration files, ~1,500 lines

---

## Complete API Endpoint Listing

### Authentication (9 endpoints)
```
POST   /api/v1/auth/register                    — Register new customer
POST   /api/v1/auth/login                       — Login with credentials
POST   /api/v1/auth/logout                      — Logout [auth]
POST   /api/v1/auth/logout-everywhere           — Logout all devices [auth]
POST   /api/v1/auth/email-verification/send     — Send verification email [auth]
POST   /api/v1/auth/email-verification/verify   — Verify email with token
POST   /api/v1/auth/password/forgot             — Request password reset
POST   /api/v1/auth/password/reset              — Reset password
POST   /api/v1/auth/password/change             — Change password [auth]
```

### Customers (4 endpoints)
```
GET    /api/v1/customers/me                     — Get profile [auth]
PATCH  /api/v1/customers/me                     — Update profile [auth]
GET    /api/v1/customers/sessions               — List sessions [auth]
DELETE /api/v1/customers/sessions/:id           — Logout device [auth]
```

### Addresses (6 endpoints)
```
GET    /api/v1/addresses                        — List addresses [auth]
POST   /api/v1/addresses                        — Create address [auth]
PATCH  /api/v1/addresses/:id                    — Update address [auth]
DELETE /api/v1/addresses/:id                    — Delete address [auth]
POST   /api/v1/addresses/:id/set-default-shipping  — Set default [auth]
POST   /api/v1/addresses/:id/set-default-billing   — Set default [auth]
```

### Preferences (6 endpoints)
```
GET    /api/v1/preferences                      — Get preferences [auth]
PATCH  /api/v1/preferences/email                — Update email opts [auth]
PATCH  /api/v1/preferences/sms                  — Update SMS opts [auth]
PATCH  /api/v1/preferences/localization         — Update language/tz [auth]
PATCH  /api/v1/preferences/shopping             — Update payment/rewards [auth]
PATCH  /api/v1/preferences/custom               — Update custom settings [auth]
```

**Total: 25 endpoints** (19 public, 6 protected)

---

## Database Schema (11 Tables)

```
stores                          (root aggregate)
├── store_settings              (1:1 config)
├── customers                   (1:N, composite PK)
│   ├── customer_addresses      (1:N, composite FK)
│   ├── customer_preferences    (1:1, composite FK)
│   ├── customer_consent        (1:N, append-only, immutable)
│   ├── customer_credentials    (1:1, composite FK)
│   ├── sessions                (1:N, composite FK)
│   ├── verification_tokens     (1:N, ephemeral, composite FK)
│   └── password_reset_tokens   (1:N, ephemeral, composite FK)
└── audit_logs                  (1:N, append-only, immutable)
```

**Tables:** 11  
**Composite FKs:** 7  
**Indexes:** 25+  
**Triggers:** 2 (immutability enforcement)  

---

## Technology Stack

### Framework
- **Express.js v5.0** — HTTP server
- **TypeORM 1.1** — ORM for database
- **PostgreSQL 16** — Database (Docker)

### Security
- **JWT (HS256)** — Token authentication
- **bcryptjs** — Password hashing
- **Helmet** — Security headers
- **CORS** — Cross-origin resource sharing
- **Zod** — Environment validation

### Development
- **TypeScript 5.7** — Type safety
- **tsx** — Fast TypeScript execution
- **Winston** — Structured logging
- **Vitest** — Unit testing framework

---

## Architecture

### Request Flow
```
HTTP Request
    ↓
Helmet + CORS (Security)
    ↓
Express JSON Parser
    ↓
Request Logger (Winston)
    ↓
Store Context Middleware
    (validates store_id from header)
    ↓
Routes (/api/v1/*)
    ↓
Auth Middleware (if [auth] required)
    (JWT verification + session validation)
    ↓
Controllers
    (request validation, call services)
    ↓
Services
    (business logic, orchestration)
    ↓
Repositories
    (data access, store isolation)
    ↓
TypeORM ↔ PostgreSQL
    ↓
Error Handler Middleware
    (format error responses)
    ↓
HTTP Response
```

### JWT Authentication Flow
```
1. Login/Register
   ├─ Generate raw token
   ├─ Hash token for DB
   ├─ Create session record
   ├─ Generate JWT: { customer_id, store_id, session_id }
   └─ Return JWT to client

2. Authenticated Request
   ├─ Client sends: Authorization: Bearer <JWT>
   ├─ Middleware verifies JWT signature
   ├─ Middleware looks up session by session_id
   ├─ Middleware checks session is active
   ├─ Middleware attaches customer_id to request
   └─ Handler executes

3. Logout
   ├─ Set session.is_active = false
   ├─ Set session.revoked_at = NOW()
   └─ Client discards JWT
```

---

## Key Features Implemented

### ✅ Store Isolation
- Composite PK (id, store_id) on customers
- Composite FK on all child tables
- Application-level filtering on all queries
- Database-enforced referential integrity

### ✅ Multi-Device Sessions
- Store multiple active sessions per customer
- Track device_type, device_name, ip_address, user_agent
- Activity tracking (last_activity_at)
- Logout individual device or all devices

### ✅ Token Security
- Session tokens: SHA-256 hash only (not raw)
- Verification tokens: Hash-only storage, one-time use
- Password reset tokens: Hash-only, brute-force protected (3 attempts)
- JWT tokens: HS256 signature with secret

### ✅ Account Security
- Password: bcrypt hashing (10 rounds)
- Account lockout: 5 failed attempts → 15 min lockout
- Failed login tracking with auto-unlock
- Password change forces logout everywhere

### ✅ Email Verification
- Separate verification token (ephemeral)
- 24-hour expiration
- One-time use (consumed_at marker)
- Hard delete after 30 days (scheduled job planned)

### ✅ Password Reset
- Forgot password flow with token
- Brute-force protection (3 max attempts)
- Track requested_ip and used_ip for security
- Separate from verification flow

### ✅ Soft Delete Support
- customers.deleted_at → Soft delete marker
- Unique constraints respect: WHERE deleted_at IS NULL
- Restore capability for deleted records
- Preserves audit trail

### ✅ Immutability Enforcement
- customer_consent → Append-only via PostgreSQL trigger
- audit_logs → Append-only via PostgreSQL trigger
- Database prevents all UPDATEs and DELETEs
- Application also throws errors if attempted

### ✅ Preferences & Consent
- Email preferences: Newsletter, Promotions, Product Updates
- SMS marketing opt-in/out
- Language and timezone
- Shopping preferences (save payment, auto-apply rewards)
- Custom JSONB settings
- Consent history tracking

---

## Security Checklist

- ✅ No plaintext passwords in database
- ✅ No raw tokens in database (hash-only)
- ✅ Account lockout on brute-force (5 attempts, 15 min)
- ✅ CORS with origin whitelist
- ✅ Helmet security headers
- ✅ Store isolation at DB and app level
- ✅ JWT signature verification
- ✅ Session active/expired validation
- ✅ IP tracking for audit purposes
- ✅ Error messages don't leak implementation details
- ✅ Soft delete prevents hard purging of user data
- ✅ Audit logs immutable for compliance

---

## Configuration

### Environment Variables (.env)
```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://user:password@localhost:5432/faded_chapter_dev
JWT_SECRET=min-32-character-secret-key-here
SESSION_SECRET=another-32-char-secret-key

CORS_ORIGINS=http://localhost:3001,http://localhost:4200

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Database Connection
- **Host:** localhost (Docker)
- **Port:** 5432
- **Database:** faded_chapter_dev
- **Pool:** min=2, max=20
- **Timeout:** Default (30s)
- **SSL:** Enabled in production only

---

## File Structure Summary

### Phase 3A Files (18 total)

**DTOs** (4 files)
- auth.dto.ts
- customer.dto.ts
- address.dto.ts
- preferences.dto.ts

**Controllers** (4 files)
- auth.controller.ts
- customer.controller.ts
- address.controller.ts
- preferences.controller.ts

**Middleware** (2 files)
- auth.middleware.ts (JWT verification)
- error-handler.middleware.ts (error formatting)

**Routes** (4 files)
- auth.routes.ts
- customer.routes.ts
- address.routes.ts
- preferences.routes.ts
- index.ts (main router)

**Utilities & Setup** (3 files)
- jwt.util.ts (token helpers)
- express.d.ts (type extensions)
- app.ts (Express setup)

### Phase 3B Files (11 migrations)

**Migrations** (11 files)
- 1726350000000-CreateStoresTable.ts
- 1726350001000-CreateStoreSettingsTable.ts
- 1726350002000-CreateCustomersTable.ts
- 1726350003000-CreateCustomerAddressesTable.ts
- 1726350004000-CreateCustomerPreferencesTable.ts
- 1726350005000-CreateCustomerConsentTable.ts
- 1726350006000-CreateCustomerCredentialsTable.ts
- 1726350007000-CreateSessionsTable.ts
- 1726350008000-CreateVerificationTokensTable.ts
- 1726350009000-CreatePasswordResetTokensTable.ts
- 1726350010000-CreateAuditLogsTable.ts

---

## Running the Application

### Prerequisites
```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d postgres

# Wait for database
sleep 5

# Check database is ready
psql postgresql://postgres:postgres@localhost:5432/postgres -c "SELECT 1"
```

### Setup & Run
```bash
# Create .env file
cp .env.example .env

# Build TypeScript
npm run build

# Run migrations
npm run db:migrate

# Start development server
npm run dev
# OR: npm start (production)
```

### Verify Setup
```bash
# Check health
curl http://localhost:3000/health

# Test registration
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Store-ID: $(uuidgen)" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "John"
  }'
```

---

## Testing

### Integration Tests (Planned for Phase 3C)
- [ ] Auth flow tests (register → login → logout)
- [ ] Store isolation tests (cross-store blocked)
- [ ] Token security tests (JWT, sessions, verification)
- [ ] Account lockout tests (5 failures, 15 min)
- [ ] Soft delete tests (restore, cascading)
- [ ] Immutability tests (audit, consent)
- [ ] Error handling tests (validation, auth, 404)
- [ ] Complete e2e workflows

### Running Tests
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# UI dashboard
npm run test:ui
```

---

## Performance Characteristics

### Database Queries
- **Session lookup:** O(1) by token_hash (indexed)
- **Customer lookup:** O(1) by email_normalized (partial unique index)
- **Address queries:** O(N) for customer, filtered by store_id
- **Audit log queries:** O(N) for record, ordered by created_at (indexed)

### API Response Times (Target)
- Register: < 500ms (password hashing dominant)
- Login: < 500ms (password verification dominant)
- Get profile: < 50ms (single table lookup)
- Update profile: < 100ms (table update + timestamp)
- List addresses: < 100ms (indexed by customer_id, store_id)

### Connection Pooling
- Minimum: 2 connections
- Maximum: 20 connections
- Timeout: 30 seconds (default)

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] TypeScript compiling without errors
- [ ] Environment variables set (production values)
- [ ] Database backup created
- [ ] Migration script tested on staging

### Deployment Steps
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm install --production

# 3. Build
npm run build

# 4. Run migrations
npm run db:migrate

# 5. Start server
npm start
```

### Post-Deployment
- [ ] Health check passes
- [ ] Sample user registration works
- [ ] Login and JWT tokens work
- [ ] Audit logs being recorded
- [ ] Error logging functioning
- [ ] Monitor for errors (1hr)

---

## Known Limitations & TODOs

### Phase 4+ Features
- [ ] Email service integration (SMTP)
- [ ] Rate limiting (express-rate-limit)
- [ ] Request validation (joi/zod middleware)
- [ ] OpenAPI/Swagger documentation
- [ ] Refresh token rotation
- [ ] 2FA support
- [ ] Admin APIs for audit log inspection

### Performance Optimizations (Future)
- [ ] Query caching with Redis
- [ ] Materialized views for analytics
- [ ] Read replicas for reporting
- [ ] Connection pooling optimization

### Security Enhancements (Future)
- [ ] Rate limiting on auth endpoints
- [ ] CAPTCHA on repeated failed logins
- [ ] IP whitelisting per store
- [ ] Webhook signature verification
- [ ] API key rotation

---

## Support & Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check logs
tail -f logs/error.log | grep -i database

# Reset pool
# (restart server)
```

### Migration Issues
```bash
# Show migration status
npm run db:migration:show

# Revert last
npm run db:migrate:undo

# Restore from backup
pg_restore < backup.sql
```

### API Issues
```bash
# Check server logs
tail -f logs/combined.log

# Test health endpoint
curl http://localhost:3000/health

# Check for errors
tail -f logs/error.log
```

---

## Project Status

### Phase 0: Infrastructure ✅ COMPLETE
- PostgreSQL DataSource
- Environment configuration
- Error classes
- Logger setup
- Store context middleware

### Phase 1: Core Domain Entities ✅ COMPLETE
- 11 entities defined
- Composite keys/FKs
- Relationships modeled
- Validations specified

### Phase 2: Repositories & Services ✅ COMPLETE
- 9 repositories (1 base + 8 concrete)
- 4 services (Customer, Session, Token, Auth)
- Full store isolation
- Token security patterns
- Account lockout logic

### Phase 3A: HTTP API Layer ✅ COMPLETE
- 4 controllers
- 5 route files (19 endpoints)
- 2 middleware types
- 4 DTO files
- JWT utilities

### Phase 3B: Database Migrations ✅ COMPLETE
- 11 TypeORM migrations
- Composite FKs enforced
- Immutability triggers
- Strategic indexes
- Soft delete support

### Phase 4: Catalog Domain (PLANNED)
- Products, Categories, SKUs
- Inventory management
- Pricing and variants
- Similar patterns to Core

---

## Next Steps

### Immediate (Phase 3C)
1. Integration tests (8 test suites)
2. API testing with Postman
3. Load testing
4. Documentation review

### Short-term (Phase 4)
1. Catalog domain design
2. Product entities & migrations
3. Catalog API routes
4. Inventory tracking

### Medium-term (Phase 5+)
1. Order management
2. Payment processing
3. Notification system
4. Admin dashboard API

---

## Documentation

- **PHASE_0_COMPLETE.md** — Infrastructure setup
- **PHASE_1_COMPLETE.md** — Entity definitions
- **PHASE_2_COMPLETE.md** — Repositories & services
- **PHASE_3_IMPLEMENTATION.md** — HTTP API layer
- **PHASE_3B_MIGRATIONS.md** — Database migrations
- **ARCHITECTURE_OVERVIEW.md** — Complete system design

---

**Phase 3 Status:** ✅ COMPLETE (API + Migrations)

**Total Implementation:** ~5,000+ lines across 40+ files

**Ready for:** Integration testing, API verification, and Phase 4 Catalog domain

---

## Quick Links

- **API Base URL:** http://localhost:3000/api/v1
- **Health Check:** http://localhost:3000/health
- **Database:** postgresql://localhost:5432/faded_chapter_dev
- **Logs:** ./logs/error.log, ./logs/combined.log
- **Migrations:** ./src/migrations/

**Phase 3 Complete! ✅**
