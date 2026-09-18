# Phase 3B: Database Migrations — COMPLETE

**Status:** ✅ MIGRATIONS IMPLEMENTED

**Date:** 2026-09-14

**Summary:** All 11 TypeORM migrations created with proper indexes, foreign keys, and PostgreSQL triggers for immutability.

---

## Migrations Created (11 files)

### 1. **CreateStoresTable** (Timestamp: 1726350000000)
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
)

-- Indexes: slug, domain, status
```

### 2. **CreateStoreSettingsTable** (Timestamp: 1726350001000)
```sql
CREATE TABLE store_settings (
  id UUID PRIMARY KEY,
  store_id UUID UNIQUE NOT NULL (FK → stores),
  default_currency VARCHAR(3),
  default_timezone VARCHAR(50),
  default_locale VARCHAR(10),
  guest_checkout_enabled BOOLEAN,
  customer_accounts_enabled BOOLEAN,
  email_verification_required BOOLEAN,
  order_confirmation_email BOOLEAN,
  order_shipped_email BOOLEAN,
  inventory_tracking_enabled BOOLEAN,
  low_stock_alert_enabled BOOLEAN,
  tax_calculation_enabled BOOLEAN,
  maintenance_mode BOOLEAN,
  settings_json JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- FK: store_id → stores ON DELETE CASCADE
```

### 3. **CreateCustomersTable** (Timestamp: 1726350002000)
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
  FK: store_id → stores ON DELETE RESTRICT
)

-- Indexes: store_id, (store_id, status), created_at
-- UNIQUE (store_id, email_normalized) WHERE deleted_at IS NULL
```

### 4. **CreateCustomerAddressesTable** (Timestamp: 1726350003000)
```sql
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  store_id UUID NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  state_province VARCHAR(255) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_default_shipping BOOLEAN DEFAULT false,
  is_default_billing BOOLEAN DEFAULT false,
  label VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FK (customer_id, store_id) → customers(id, store_id) ON DELETE CASCADE
)

-- Indexes: (customer_id, store_id), defaults
```

### 5. **CreateCustomerPreferencesTable** (Timestamp: 1726350004000)
```sql
CREATE TABLE customer_preferences (
  id UUID PRIMARY KEY,
  customer_id UUID UNIQUE NOT NULL,
  store_id UUID NOT NULL,
  email_newsletter BOOLEAN DEFAULT false,
  email_promotions BOOLEAN DEFAULT false,
  email_product_updates BOOLEAN DEFAULT false,
  email_transactional BOOLEAN DEFAULT true,
  sms_marketing BOOLEAN DEFAULT false,
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  save_payment_method BOOLEAN DEFAULT false,
  auto_apply_rewards BOOLEAN DEFAULT false,
  custom_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FK (customer_id, store_id) → customers(id, store_id) ON DELETE CASCADE
)
```

### 6. **CreateCustomerConsentTable** (Timestamp: 1726350005000)
```sql
CREATE TABLE customer_consent (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  store_id UUID NOT NULL,
  consent_type VARCHAR(255) NOT NULL,
  granted BOOLEAN NOT NULL,
  policy_version VARCHAR(50) NOT NULL,
  policy_url VARCHAR(500) NOT NULL,
  source VARCHAR(100) NOT NULL,
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FK (customer_id, store_id) → customers(id, store_id) ON DELETE RESTRICT
)

-- IMMUTABILITY TRIGGER: prevent_customer_consent_mutation()
--   BEFORE UPDATE OR DELETE: RAISE EXCEPTION
```

### 7. **CreateCustomerCredentialsTable** (Timestamp: 1726350006000)
```sql
CREATE TABLE customer_credentials (
  id UUID PRIMARY KEY,
  customer_id UUID UNIQUE NOT NULL,
  store_id UUID NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  hash_algorithm VARCHAR(50) DEFAULT 'bcrypt',
  hash_version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FK (customer_id, store_id) → customers(id, store_id) ON DELETE CASCADE
)
```

### 8. **CreateSessionsTable** (Timestamp: 1726350007000)
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  store_id UUID NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  ip_address INET NOT NULL,
  user_agent VARCHAR(500),
  device_type VARCHAR(50),
  device_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  
  FK (customer_id, store_id) → customers(id, store_id) ON DELETE CASCADE
)

-- Indexes: (customer_id, store_id), token_hash, active, expires_at
```

### 9. **CreateVerificationTokensTable** (Timestamp: 1726350008000)
```sql
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  store_id UUID NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  purpose VARCHAR(50) DEFAULT 'email_verification',
  email VARCHAR(255) NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  FK (customer_id, store_id) → customers(id, store_id) ON DELETE CASCADE
)

-- Indexes: token_hash, (customer_id, store_id), expires_at
```

### 10. **CreatePasswordResetTokensTable** (Timestamp: 1726350009000)
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  store_id UUID NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  requested_ip_address INET,
  used_ip_address INET,
  
  FK (customer_id, store_id) → customers(id, store_id) ON DELETE CASCADE
)

-- Indexes: token_hash, (customer_id, store_id), expires_at
```

### 11. **CreateAuditLogsTable** (Timestamp: 1726350010000)
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  record_id UUID NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB DEFAULT '{}',
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FK: store_id → stores ON DELETE CASCADE
)

-- IMMUTABILITY TRIGGER: prevent_audit_log_mutation()
--   BEFORE UPDATE OR DELETE: RAISE EXCEPTION
-- Indexes: store_id, (table_name, record_id), actor_id, created_at
```

---

## Key Features in Migrations

### ✅ Composite Primary Keys
- **customers** — (id, store_id)
- Enforces multi-tenancy at database level

### ✅ Composite Foreign Keys
- **customer_addresses** — (customer_id, store_id) → customers(id, store_id)
- **customer_preferences** — (customer_id, store_id) → customers(id, store_id)
- **customer_consent** — (customer_id, store_id) → customers(id, store_id)
- **customer_credentials** — (customer_id, store_id) → customers(id, store_id)
- **sessions** — (customer_id, store_id) → customers(id, store_id)
- **verification_tokens** — (customer_id, store_id) → customers(id, store_id)
- **password_reset_tokens** — (customer_id, store_id) → customers(id, store_id)

### ✅ Immutability Triggers
**prevent_customer_consent_mutation()** — Blocks all UPDATEs and DELETEs on customer_consent
**prevent_audit_log_mutation()** — Blocks all UPDATEs and DELETEs on audit_logs

### ✅ Strategic Indexes
- Store filtering: idx_*_store_id
- Uniqueness: idx_customers_email_normalized_active (partial)
- Token lookups: idx_*_token_hash
- Session queries: idx_sessions_active
- Expiry cleanup: idx_*_expires_at
- Audit queries: idx_audit_logs_record, idx_audit_logs_actor

### ✅ Soft Delete Support
- customers.deleted_at — Soft delete marker
- Unique indexes respect: WHERE deleted_at IS NULL

### ✅ JSONB Columns
- store_settings.settings_json — Custom configuration
- customer_preferences.custom_settings — Custom preferences
- audit_logs.changes — Change history {field: {old, new}}

### ✅ Time Zone Support
- All TIMESTAMPTZ columns for UTC consistency
- Timezone storage in customer_preferences for display

---

## Running Migrations

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure PostgreSQL is running
docker-compose up -d postgres

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/faded_chapter_dev
```

### Run All Migrations
```bash
# Compile TypeScript first
npm run build

# Run pending migrations
npm run db:migrate

# Or with ts-node (dev)
npx ts-node src/scripts/run-migrations.ts
```

### Revert Last Migration
```bash
npm run db:migrate:undo
```

### Show Pending Migrations
```bash
npm run db:migration:generate -d dist/core/database/postgres-data-source.js
```

---

## Migration Safety

### Pre-Migration Checklist
- [ ] Database backed up
- [ ] No active connections
- [ ] All services stopped
- [ ] Migration script tested on staging

### Post-Migration Verification
```bash
# Verify tables created
psql $DATABASE_URL -c "\dt"

# Check indexes
psql $DATABASE_URL -c "\di"

# Verify triggers exist
psql $DATABASE_URL -c "
  SELECT trigger_name, event_object_table
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
"

# Test a query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM stores"
```

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"
**Cause:** Migrations already run  
**Solution:** Check `typeorm_migrations` table
```bash
psql $DATABASE_URL -c "SELECT * FROM typeorm_migrations"
```

### Issue: Composite FK errors
**Cause:** Parent table rows missing  
**Solution:** Create store + customer first
```sql
INSERT INTO stores (id, name, slug) VALUES ('uuid', 'Test', 'test');
INSERT INTO customers (id, store_id, email, email_normalized, status) 
  VALUES ('uuid', 'store_uuid', 'test@example.com', 'test@example.com', 'active');
```

### Issue: Trigger not firing
**Cause:** TypeORM doesn't execute SQL directly  
**Solution:** Manually verify trigger was created
```bash
psql $DATABASE_URL -c "SELECT pg_get_triggerdef('prevent_audit_log_mutation')"
```

### Issue: Index creation slow
**Cause:** Large existing data  
**Solution:** Run migrations during maintenance window
- Background migration: `CONCURRENTLY` option (not in TypeORM by default)
- Manual migration with `CREATE INDEX CONCURRENTLY`

---

## Database Schema Diagram

```
stores (root)
├── store_settings (1:1)
├── customers (1:N)
│   ├── customer_addresses (1:N)
│   ├── customer_preferences (1:1)
│   ├── customer_consent (1:N, append-only)
│   ├── customer_credentials (1:1)
│   ├── sessions (1:N)
│   ├── verification_tokens (1:N, ephemeral)
│   └── password_reset_tokens (1:N, ephemeral)
└── audit_logs (1:N, append-only)
```

---

## Testing After Migrations

### 1. Verify Store Isolation
```typescript
// Two different stores, same email should work
const store1Customer = await customers.create({
  email: 'user@example.com',
  store_id: 'store-1-id'
});

const store2Customer = await customers.create({
  email: 'user@example.com',
  store_id: 'store-2-id'
});
// ✅ Both succeed (unique constraint: store_id + email)
```

### 2. Verify Immutability
```typescript
// Try to update audit log
await db.query(`
  UPDATE audit_logs 
  SET action = 'delete' 
  WHERE id = '...'
`);
// ❌ ERROR: Audit logs are immutable and cannot be updated
```

### 3. Verify Composite FK
```typescript
// Try to insert address with mismatched store_id
await db.query(`
  INSERT INTO customer_addresses (customer_id, store_id, ...)
  VALUES ('customer-1', 'store-2', ...)
`);
// ❌ ERROR: FK violation if customer_1 belongs to store-1
```

### 4. Verify Soft Delete
```typescript
// Soft delete customer
UPDATE customers SET deleted_at = NOW() WHERE id = '...';

// Try to create same email
INSERT INTO customers (email, email_normalized, store_id, ...)
VALUES ('same@email.com', 'same@email.com', 'store-1', ...);
// ✅ Succeeds (deleted_at IS NULL constraint allows reuse)
```

---

## Migration Files Location

```
src/migrations/
├── 1726350000000-CreateStoresTable.ts
├── 1726350001000-CreateStoreSettingsTable.ts
├── 1726350002000-CreateCustomersTable.ts
├── 1726350003000-CreateCustomerAddressesTable.ts
├── 1726350004000-CreateCustomerPreferencesTable.ts
├── 1726350005000-CreateCustomerConsentTable.ts
├── 1726350006000-CreateCustomerCredentialsTable.ts
├── 1726350007000-CreateSessionsTable.ts
├── 1726350008000-CreateVerificationTokensTable.ts
├── 1726350009000-CreatePasswordResetTokensTable.ts
├── 1726350010000-CreateAuditLogsTable.ts
└── index.ts (barrel export)
```

---

## TypeORM Configuration

**File:** `src/core/database/postgres-data-source.ts`

```typescript
new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  
  entities: ['dist/core/entities/*.entity.js'],
  migrations: ['dist/migrations/*.js'],  // ← Updated path
  
  synchronize: false,  // Use migrations in production
})
```

---

## Quick Start (Fresh Database)

```bash
# 1. Create PostgreSQL container
docker-compose up -d postgres

# 2. Wait for PostgreSQL to be ready
sleep 5

# 3. Build TypeScript
npm run build

# 4. Run all migrations
npm run db:migrate

# 5. Check migration table
npm run db:show-migrations

# 6. Start server
npm run dev

# 7. Test API
curl http://localhost:3000/health
```

---

## Production Deployment

### 1. Pre-Deploy Validation
```bash
# Generate migrations (ensures no pending changes)
npm run db:migration:generate -- -n ManualMigration

# Should show: No changes in database schema
```

### 2. Backup Database
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### 3. Deploy New Code
```bash
git pull origin main
npm install
npm run build
```

### 4. Run Migrations
```bash
npm run db:migrate
```

### 5. Verify and Monitor
```bash
# Check migration status
npm run db:migration:show

# Monitor application logs
tail -f logs/error.log
tail -f logs/combined.log

# Query metrics
SELECT COUNT(*) FROM typeorm_migrations;
```

### 6. Rollback Plan (if needed)
```bash
# Revert last migration
npm run db:migrate:undo

# Or restore from backup
psql < backup-20260914.sql
```

---

## Next Steps: Phase 3C

Once migrations are verified:

1. **Integration Tests** — Test all auth flows, store isolation, etc.
2. **API Testing** — Use Postman collection or curl
3. **Load Testing** — Verify indexes are effective
4. **Documentation** — Generate API docs

---

**Phase 3B Status:** ✅ MIGRATIONS COMPLETE

**Ready for:** Integration testing and API verification

---

## Files Summary

**New Migration Files:** 11 TypeORM migration files
**Total Migration Code:** ~1,500 lines
**Database Tables:** 11 tables created
**Indexes:** 25+ strategic indexes
**Triggers:** 2 immutability triggers
**Composite FKs:** 7 child tables with composite keys

**Phase 3B Completion:** ✅ ALL MIGRATIONS IMPLEMENTED
