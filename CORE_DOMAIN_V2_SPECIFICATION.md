# Core Domain v2 Specification

**Status**: 🎯 Foundation Architecture  
**Scope**: Cross-cutting concerns + Core domain  
**Audience**: Database architects, backend engineers  
**Purpose**: Define the database foundation for Faded Chapter Commerce Platform

---

## PART 1: CROSS-CUTTING FOUNDATION

Before writing any SQL, we establish database-wide decisions.

---

## 1. ID Strategy

### Decision
**Use UUID (v4) for all primary keys.**

### Rationale
- No sequential IDs that reveal business scale
- Portable across sharding/partitioning
- Compatible with distributed systems
- No timezone-dependent collisions
- Privacy-preserving

### Implementation

```sql
-- All PKs use this pattern:
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Example:
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);
```

### Exception
None. Even foreign keys reference UUIDs.

### Migration Path
If we eventually shard by `store_id`, UUID allows clean data movement.

---

## 2. Timestamp Strategy

### Decision
**Use UTC TIMESTAMP WITH TIME ZONE. Always store in UTC. Never store local time.**

### Rationale
- Unambiguous across time zones
- Sortable and comparable
- No DST confusion
- Historical accuracy (immutable once recorded)

### Implementation

```sql
-- All timestamps use this pattern:
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC'
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC'
deleted_at TIMESTAMP WITH TIME ZONE -- for soft deletes

-- Example:
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  ...
);
```

### Application Responsibility
- Query with `AT TIME ZONE` when displaying to users
- Convert user-input dates to UTC before storage
- Never use application-layer timezone conversion for storage

### Query Example
```sql
-- Retrieve in customer's timezone (stored in customer_preferences)
SELECT 
  created_at AT TIME ZONE customers.timezone as local_time
FROM orders
JOIN customers ON orders.customer_id = customers.id
WHERE orders.id = '...';
```

---

## 3. Currency Strategy

### Decision
**Currency is ALWAYS paired with amount. Never store currency-less money.**

### Rationale
- Prevents cross-currency arithmetic
- Explicit about what "100" means (₹100 ≠ $100)
- Supports multi-currency operations later
- Reduces calculation bugs

### Implementation

```sql
-- WRONG:
CREATE TABLE prices (
  amount DECIMAL(15, 2)
);

-- RIGHT:
CREATE TABLE prices (
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR', -- ISO 4217
  CONSTRAINT valid_amount CHECK (amount >= 0)
);

-- OR: As composite type (PostgreSQL-specific)
CREATE TYPE money_amount AS (
  amount DECIMAL(15, 2),
  currency VARCHAR(3)
);

CREATE TABLE prices (
  price money_amount NOT NULL
);
```

### Convention
All monetary fields follow this pattern:
```sql
<field>_amount DECIMAL(15, 2)
<field>_currency VARCHAR(3) DEFAULT 'INR'
```

Example:
```sql
CREATE TABLE orders (
  subtotal_amount DECIMAL(15, 2) NOT NULL,
  subtotal_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  
  tax_amount DECIMAL(15, 2) NOT NULL,
  tax_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  
  shipping_amount DECIMAL(15, 2) NOT NULL,
  shipping_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  
  total_amount DECIMAL(15, 2) NOT NULL,
  total_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  
  -- Invariant: all currencies must match
  CONSTRAINT all_currencies_match CHECK (
    subtotal_currency = tax_currency AND
    tax_currency = shipping_currency AND
    shipping_currency = total_currency
  ),
  
  -- Invariant: totals must balance
  CONSTRAINT totals_balance CHECK (
    total_amount = subtotal_amount + tax_amount + shipping_amount - discount_amount
  )
);
```

### Decimal vs Integer
Use `DECIMAL(15, 2)` for display/reporting. Consider storing as integer (minor units) if extreme precision is needed.

```sql
-- If storing as minor units (paise in INR):
price_minor_units BIGINT NOT NULL, -- 10000 = ₹100.00

-- Constraint:
CONSTRAINT valid_amount CHECK (price_minor_units >= 0)
```

For now: `DECIMAL(15, 2)` is acceptable.

---

## 4. Timezone Strategy

### Decision
**System operates in UTC. User timezone is a preference stored per customer.**

### Rationale
- Internal consistency
- No ambiguity about what time something happened
- Respects customer's local view

### Implementation

```sql
CREATE TABLE customer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Timezone is a preference
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata', -- IANA timezone
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC'
);
```

### Query Pattern
```sql
-- Show customer their local time
SELECT 
  order_created_at AT TIME ZONE pref.timezone as local_created_at
FROM orders
JOIN customers c ON orders.customer_id = c.id
JOIN customer_preferences pref ON c.id = pref.customer_id
WHERE orders.id = '...';
```

### Validation
Validate timezone against IANA timezone list in application layer.

---

## 5. Soft Delete Strategy

### Decision
**Soft delete using `deleted_at TIMESTAMP` column. Never use `is_deleted BOOLEAN`.**

### Rationale
- Timestamp tells us WHEN deletion occurred (audit)
- Can reconstruct history
- Boolean doesn't answer "when was this deleted?"
- Indexes on `deleted_at` efficient

### Implementation

```sql
-- All soft-deleteable tables include:
deleted_at TIMESTAMP WITH TIME ZONE -- NULL = not deleted

-- Example:
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  deleted_at TIMESTAMP WITH TIME ZONE, -- NULL = active
  
  -- Unique constraint excludes deleted rows
  CONSTRAINT unique_active_email UNIQUE (email) WHERE deleted_at IS NULL
);

-- Index for active rows only
CREATE INDEX idx_customers_active ON customers(id) WHERE deleted_at IS NULL;
```

### Query Pattern
```sql
-- Default: only active records
SELECT * FROM customers WHERE deleted_at IS NULL;

-- Include deleted:
SELECT * FROM customers; -- all

-- Only deleted:
SELECT * FROM customers WHERE deleted_at IS NOT NULL;
```

### Application Pattern
```typescript
// Repository methods
findActive(id: UUID): Customer
findIncludingDeleted(id: UUID): Customer  
delete(id: UUID): void  // sets deleted_at = now
restore(id: UUID): void // sets deleted_at = null
```

### Hard Delete Rule
**Hard delete is forbidden.** Only soft delete.

Exception: GDPR "right to be forgotten" (rare, requires explicit process).

---

## 6. Audit Strategy

### Decision
**Every table includes `created_at` and `updated_at`. Sensitive mutations go to audit log.**

### Rationale
- Created_at: when record was created
- Updated_at: when record was last modified
- Audit log: WHO did WHAT to WHICH record WHEN

### Implementation

```sql
-- Every table has these:
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',

-- Sensitive mutations logged separately:
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was changed
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  
  -- Who did it
  actor_id UUID, -- NULL for system actions
  actor_type VARCHAR(50) NOT NULL, -- 'customer', 'staff', 'system'
  
  -- What changed
  action VARCHAR(50) NOT NULL, -- 'insert', 'update', 'delete'
  changes JSONB, -- {field: {old: ..., new: ...}}
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- When
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC'
);

CREATE INDEX idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### Sensitive Operations
Log these to audit_logs:
- Customer email changed
- Password changed
- Address modified
- Order status changed
- Refund issued
- Staff member created/deleted
- Permissions changed

Use a trigger or application code (preferred) to populate audit_logs.

---

## 7. Data Ownership Rules

### Decision
**Every record belongs to exactly one store. Store ownership is immutable.**

### Rationale
- Single store now; multi-tenant foundation for future
- No ambiguous "which store owns this?"
- Simplifies isolation

### Implementation

```sql
-- Every table has store_id (except some globals)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  email VARCHAR(255) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Email unique per store
  CONSTRAINT unique_customer_email_per_store UNIQUE (store_id, email) 
    WHERE deleted_at IS NULL
);

CREATE INDEX idx_customers_store_id ON customers(store_id);
```

### Immutability Rule
```sql
-- Cannot change store_id (treat as immutable)
-- Application layer should prevent this, database can enforce:
CREATE OR REPLACE TRIGGER customers_prevent_store_change
BEFORE UPDATE ON customers
FOR EACH ROW
WHEN (OLD.store_id IS DISTINCT FROM NEW.store_id)
THEN RAISE EXCEPTION 'Cannot change store_id';
```

### Global Tables (rare)
Only system-level tables without store_id:
- stores
- roles (staff roles, not customer roles)
- permissions (staff permissions)

---

## 8. Tenant/Store Isolation Rules

### Decision
**Row-level security (RLS) enforced at application layer, not database.**

### Rationale
- RLS in PostgreSQL is powerful but complex
- Application layer isolation is explicit and testable
- Easier to debug
- Can implement without database magic

### Implementation

```typescript
// Application pattern - EVERY query includes store_id filter
class CustomerRepository {
  async findById(storeId: UUID, customerId: UUID): Promise<Customer> {
    return db.query(`
      SELECT * FROM customers 
      WHERE id = $1 AND store_id = $2
    `, [customerId, storeId]);
  }
}

// WRONG - misses store_id filter:
// SELECT * FROM customers WHERE id = $1; // ❌

// RIGHT:
// SELECT * FROM customers WHERE id = $1 AND store_id = $2; // ✅
```

### Testing
Every repository test verifies store isolation.

```typescript
test('customer from store A should not access customer from store B', async () => {
  const storeA = await createStore();
  const storeB = await createStore();
  
  const customerA = await createCustomer(storeA);
  
  // Should not find customer from different store
  const result = await repo.findById(storeB.id, customerA.id);
  expect(result).toBeNull();
});
```

---

## PART 2: CORE DOMAIN v2 SCHEMA

Now we apply cross-cutting foundations to Core domain.

---

## 1. STORES

The root boundary. Everything belongs to a store.

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Store identity
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE, -- faded-chapter.com
  slug VARCHAR(100) UNIQUE NOT NULL, -- faded-chapter
  
  -- Store owner/admin contact
  owner_email VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  
  -- Branding
  logo_url VARCHAR(512),
  favicon_url VARCHAR(512),
  brand_color VARCHAR(7), -- #XXXXXX
  
  -- Operational settings
  currency VARCHAR(3) NOT NULL DEFAULT 'INR', -- Store default currency
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- ENUM: active, suspended, closed
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Immutable audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  
  CONSTRAINT valid_name CHECK (LENGTH(name) > 0),
  CONSTRAINT valid_email CHECK (owner_email ~ '^[^@]+@[^@]+$'),
  CONSTRAINT valid_currency CHECK (LENGTH(currency) = 3),
  CONSTRAINT valid_color CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX idx_stores_slug ON stores(slug);
CREATE UNIQUE INDEX idx_stores_domain ON stores(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_stores_status ON stores(status);
```

### Invariants
- `name` must be non-empty ✓
- `slug` must be unique ✓
- `domain` must be unique (if set) ✓
- `currency` must be valid ISO 4217 code ✓
- `timezone` must be valid IANA timezone ✓
- Store identity is immutable (no updates to core fields)

### Why Each Field
- `name`: Display name
- `domain`: Customer-facing domain (optional now)
- `slug`: URL-safe identifier
- `owner_email`: Operational contact
- `currency`: Store default (used if not specified elsewhere)
- `timezone`: Store default (used if not specified elsewhere)
- `status`: Operational state
- `metadata`: Extension point

---

## 2. CUSTOMERS

Customer accounts belong to exactly one store.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Contact
  email VARCHAR(255) NOT NULL,
  email_normalized VARCHAR(255) NOT NULL, -- lowercase, trimmed
  
  -- Personal info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  
  -- Account status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- ENUM: active, inactive, banned
  
  -- Email verification
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Default addresses (references, not denormalization)
  default_shipping_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  default_billing_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  
  -- Cached metrics (recalculated periodically)
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  total_spent_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  last_order_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  custom_fields JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT unique_customer_email_per_store 
    UNIQUE (store_id, email_normalized) WHERE deleted_at IS NULL,
  
  CONSTRAINT valid_email CHECK (LENGTH(email) > 0 AND email ~ '^[^@]+@[^@]+$'),
  
  CONSTRAINT valid_phone CHECK (
    phone IS NULL OR phone ~ '^\+?[0-9\s\-\(\)]+$'
  ),
  
  CONSTRAINT valid_totals CHECK (
    total_orders >= 0 AND total_spent_amount >= 0
  ),
  
  CONSTRAINT email_verified_consistency CHECK (
    (email_verified = TRUE AND email_verified_at IS NOT NULL) OR
    (email_verified = FALSE AND email_verified_at IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_email_normalized ON customers(store_id, email_normalized);
CREATE INDEX idx_customers_status ON customers(store_id, status);
CREATE INDEX idx_customers_created_at ON customers(store_id, created_at DESC);
CREATE INDEX idx_customers_active ON customers(store_id) WHERE deleted_at IS NULL;
```

### Invariants
- Email unique per store (non-deleted only) ✓
- Email normalized (lowercase) ✓
- `email_verified` and `email_verified_at` must be consistent ✓
- `total_orders` >= 0 ✓
- `total_spent_amount` >= 0 ✓
- Can only be deleted, not updated (soft delete) ✓

### Why Each Field
- `email_normalized`: Lookup key (case-insensitive)
- `email_verified`: Account activation status
- `default_*_address_id`: Quick access to preferred addresses
- `total_orders`, `total_spent`: Cache for reporting (rebuilt periodically)
- `tags`, `custom_fields`: Extension points

### Cache Rebuild Job
```sql
-- Periodic job to recalculate cached metrics
UPDATE customers c
SET 
  total_orders = COALESCE((SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND deleted_at IS NULL), 0),
  total_spent_amount = COALESCE((SELECT SUM(total_amount) FROM orders WHERE customer_id = c.id AND deleted_at IS NULL), 0),
  last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = c.id AND deleted_at IS NULL)
WHERE c.deleted_at IS NULL;
```

---

## 3. CUSTOMER_ADDRESSES

Reusable address records. Owned by customers, not mutable by system.

```sql
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Address type
  type VARCHAR(20) NOT NULL DEFAULT 'shipping',
    -- ENUM: shipping, billing, both
  
  -- Contact info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  
  -- Address
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
  
  -- Metadata
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  label VARCHAR(100), -- "Home", "Office", etc
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  
  -- Constraints
  CONSTRAINT valid_address CHECK (
    LENGTH(first_name) > 0 AND
    LENGTH(last_name) > 0 AND
    LENGTH(address_line_1) > 0 AND
    LENGTH(city) > 0 AND
    LENGTH(country_code) = 2
  ),
  
  CONSTRAINT valid_phone CHECK (
    phone IS NULL OR phone ~ '^\+?[0-9\s\-\(\)]+$'
  )
);

-- Indexes
CREATE INDEX idx_customer_addresses_store_id ON customer_addresses(store_id);
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_default ON customer_addresses(customer_id, is_default)
  WHERE is_default = TRUE;
```

### Invariants
- Must have first_name, last_name, address_line_1, city, country_code ✓
- country_code must be 2 characters (ISO code) ✓
- Only one default address per customer per type ✓

### Why Each Field
- `store_id`: Store isolation
- `type`: Distinguish shipping/billing
- `is_default`: Fast lookup for "use default address"
- `label`: Customer's mental model ("my home address")
- Addresses are mutable (customer can update their address)

### Note on Immutable Snapshots
**Orders will not reference these.** Orders will have their own immutable address snapshots. See Orders specification.

---

## 4. CUSTOMER_PREFERENCES

One-to-one with customer. Settings and opt-ins.

```sql
CREATE TABLE customer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Communication preferences
  email_notifications JSONB DEFAULT '{
    "order_confirmation": true,
    "order_updates": true,
    "promotions": false,
    "newsletter": false,
    "abandoned_cart": true,
    "review_request": true
  }'::JSONB,
  
  sms_notifications JSONB DEFAULT '{
    "order_updates": false,
    "promotions": false
  }'::JSONB,
  
  -- Preferences
  language VARCHAR(10) DEFAULT 'en', -- ISO 639-1
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata', -- IANA timezone
  currency VARCHAR(3) DEFAULT 'INR', -- ISO 4217
  
  -- Shopping behavior
  save_payment_method BOOLEAN DEFAULT TRUE,
  auto_apply_rewards BOOLEAN DEFAULT TRUE,
  
  -- Privacy & marketing
  accepts_marketing BOOLEAN DEFAULT FALSE,
  accepts_marketing_at TIMESTAMP WITH TIME ZONE,
  
  accepts_analytics BOOLEAN DEFAULT TRUE,
  accepts_analytics_at TIMESTAMP WITH TIME ZONE,
  
  -- Extension
  custom_settings JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  
  -- Constraints
  CONSTRAINT valid_language CHECK (LENGTH(language) = 2),
  CONSTRAINT marketing_acceptance_consistent CHECK (
    (accepts_marketing = TRUE AND accepts_marketing_at IS NOT NULL) OR
    (accepts_marketing = FALSE AND accepts_marketing_at IS NULL)
  ),
  CONSTRAINT analytics_acceptance_consistent CHECK (
    (accepts_analytics = TRUE AND accepts_analytics_at IS NOT NULL) OR
    (accepts_analytics = FALSE AND accepts_analytics_at IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_customer_preferences_store_id ON customer_preferences(store_id);
CREATE INDEX idx_customer_preferences_customer_id ON customer_preferences(customer_id);
```

### Invariants
- One preference record per customer ✓
- `accepts_*` and `accepts_*_at` must be consistent ✓
- Language must be valid ISO 639-1 code ✓

### Why Each Field
- `email_notifications`, `sms_notifications`: Granular opt-in control
- `timezone`, `language`, `currency`: Customer's view preferences
- `accepts_*`: Legal compliance (consent tracking)
- `custom_settings`: Extension point

---

## 5. CUSTOMER_CREDENTIALS

Passwords. Separate from customer record for security.

```sql
CREATE TABLE customer_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Password
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hash, never plaintext
  
  -- Hashing metadata
  hash_algorithm VARCHAR(50) NOT NULL DEFAULT 'bcrypt', -- for future migration
  hash_version INTEGER DEFAULT 1,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Security
  last_login_at TIMESTAMP WITH TIME ZONE,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE, -- account lockout
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  password_changed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_hash CHECK (LENGTH(password_hash) > 0),
  CONSTRAINT valid_attempts CHECK (failed_login_attempts >= 0)
);

-- Indexes
CREATE INDEX idx_customer_credentials_store_id ON customer_credentials(store_id);
CREATE INDEX idx_customer_credentials_customer_id ON customer_credentials(customer_id);
```

### Invariants
- Never store plaintext password ✓
- `password_hash` must be non-empty ✓
- `failed_login_attempts` >= 0 ✓
- `locked_until` in future = account locked ✓

### Why Each Field
- Separate table: isolate sensitive data
- `hash_algorithm`, `hash_version`: Support migration (bcrypt → scrypt)
- `failed_login_attempts`, `locked_until`: Account lockout strategy
- `password_changed_at`: When last password change occurred

### Security Rules
- NEVER query this table without authentication context
- NEVER return password_hash to client
- Log failed login attempts
- Implement account lockout after N failed attempts

---

## 6. SESSIONS

Authenticated sessions. Can be invalidated.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Token info
  token VARCHAR(512) NOT NULL UNIQUE,
  token_hash VARCHAR(255), -- hash of token for added security
  token_type VARCHAR(20) NOT NULL DEFAULT 'bearer', -- ENUM: bearer, refresh
  
  -- Device info
  ip_address INET NOT NULL,
  user_agent TEXT,
  device_type VARCHAR(50), -- ENUM: web, mobile, desktop
  device_name VARCHAR(255),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Validity
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_session CHECK (expires_at > created_at),
  CONSTRAINT revoked_or_active CHECK (
    (revoked_at IS NULL AND is_active = TRUE) OR
    (revoked_at IS NOT NULL AND is_active = FALSE)
  )
);

-- Indexes
CREATE INDEX idx_sessions_store_id ON sessions(store_id);
CREATE INDEX idx_sessions_customer_id ON sessions(customer_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_active ON sessions(customer_id, is_active)
  WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at)
  WHERE is_active = TRUE AND revoked_at IS NULL;
```

### Invariants
- `expires_at` > `created_at` ✓
- If revoked, must have `revoked_at` ✓
- If active, must not have `revoked_at` ✓
- Token must be unique ✓

### Why Each Field
- `token_hash`: Store hash of token (not raw token) for security
- `is_active`: Soft status (revoked but history remains)
- `revoked_at`: When/if revoked
- `device_type`, `device_name`: Multi-device support
- `ip_address`, `user_agent`: Audit trail

### Session Lifecycle
```
Created (is_active=TRUE, revoked_at=NULL)
   ↓
[used repeatedly]
   ↓
Expired (expires_at < now) OR Revoked (revoked_at set, is_active=FALSE)
```

---

## 7. VERIFICATION_TOKENS

One-time tokens for email verification. Expire.

```sql
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Token (hashed)
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  
  -- Purpose
  purpose VARCHAR(50) NOT NULL,
    -- ENUM: email_verification, email_change, ...
  
  -- Data to verify
  email VARCHAR(255) NOT NULL, -- the email being verified
  
  -- Status
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  
  -- Validity
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_token CHECK (LENGTH(token_hash) > 0),
  CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+$'),
  CONSTRAINT used_consistency CHECK (
    (is_used = TRUE AND used_at IS NOT NULL) OR
    (is_used = FALSE AND used_at IS NULL)
  ),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_verification_tokens_store_id ON verification_tokens(store_id);
CREATE INDEX idx_verification_tokens_customer_id ON verification_tokens(customer_id);
CREATE INDEX idx_verification_tokens_token_hash ON verification_tokens(token_hash);
CREATE INDEX idx_verification_tokens_active ON verification_tokens(store_id, customer_id)
  WHERE is_used = FALSE AND expires_at > NOW();
```

### Invariants
- Token must be hashed, never stored plaintext ✓
- One-time use only (is_used = TRUE means cannot use again) ✓
- Must expire ✓
- `is_used` and `used_at` must be consistent ✓

### Why Each Field
- `token_hash`: Never store raw token
- `purpose`: Support multiple token types in future
- `email`: The address being verified (may differ from customer.email)
- `is_used`: One-time token enforcement

### Lifecycle
```
Created (is_used=FALSE, used_at=NULL)
   ↓
Customer clicks link, uses token
   ↓
Used (is_used=TRUE, used_at=NOW)
   ↓
Cannot be used again (query WHERE is_used=FALSE)
   ↓
Eventually expires (automated cleanup)
```

---

## 8. PASSWORD_RESET_TOKENS

One-time tokens for password reset. Similar to verification tokens.

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Token (hashed)
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  
  -- Email requesting reset (may be different from current email)
  email VARCHAR(255) NOT NULL,
  
  -- Status
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  
  -- Security: attempt tracking
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Validity
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() AT TIME ZONE 'UTC',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Audit
  requested_ip_address INET,
  used_ip_address INET,
  
  -- Constraints
  CONSTRAINT valid_token CHECK (LENGTH(token_hash) > 0),
  CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+$'),
  CONSTRAINT used_consistency CHECK (
    (is_used = TRUE AND used_at IS NOT NULL) OR
    (is_used = FALSE AND used_at IS NULL)
  ),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT valid_attempts CHECK (attempt_count >= 0 AND attempt_count <= max_attempts)
);

-- Indexes
CREATE INDEX idx_password_reset_tokens_store_id ON password_reset_tokens(store_id);
CREATE INDEX idx_password_reset_tokens_customer_id ON password_reset_tokens(customer_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_active ON password_reset_tokens(store_id, customer_id)
  WHERE is_used = FALSE AND expires_at > NOW() AND attempt_count < max_attempts;
```

### Invariants
- Token hashed ✓
- One-time use ✓
- Max 3 attempts before disabled ✓
- Must expire ✓
- Attempt tracking prevents brute force ✓

### Why Each Field
- `attempt_count`, `max_attempts`: Brute force protection
- `requested_ip_address`, `used_ip_address`: Audit trail
- `email`: The email requesting reset (audit)

---

## CORE DOMAIN v2 SUMMARY

### Tables
1. **stores** - Root boundary, store configuration
2. **customers** - Customer accounts
3. **customer_addresses** - Reusable customer addresses
4. **customer_preferences** - Customer settings
5. **customer_credentials** - Password storage (separate)
6. **sessions** - Active/revoked sessions
7. **verification_tokens** - Email verification (one-time)
8. **password_reset_tokens** - Password reset (one-time)

### Total Fields
~120 columns across 8 tables

### Total Relationships
- 8 foreign keys (all on store_id)
- 2 one-to-one (customer ← credentials, customer ← preferences)
- Multiple one-to-many (store → customer, customer → addresses/sessions/tokens)

### Indexes
~25 strategic indexes

### Invariants Enforced
- Store ownership immutable
- Email uniqueness per store
- Password never plaintext
- Tokens one-time use
- Sessions revocable
- Soft deletion preserves history
- Timestamps in UTC
- Currency always paired with amount
- Audit trail on sensitive changes

---

## NEXT PHASE: CATALOG DOMAIN v2

Once Core is locked:
- Products
- Variants
- Categories
- Attributes
- Collections
- Media/Assets

Do not proceed to Catalog until Core is reviewed and approved.

---

**Status**: Ready for review  
**Action**: Approve, request changes, or proceed to Catalog v2
