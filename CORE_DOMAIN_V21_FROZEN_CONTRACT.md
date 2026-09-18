# Core Domain v2.1: Frozen Contract

**Status**: 🔒 FROZEN FOUNDATION  
**Version**: 2.1 (Corrections incorporated)  
**Authority**: Database Schema Authority  
**Binding**: All subsequent domains must conform to this contract  

---

## EXECUTIVE SUMMARY

Core v2.1 establishes the immutable foundation for Faded Chapter Commerce Platform. This is not a design document—it is a **contract**.

Every correction from Core v2 review has been incorporated. Every SQL statement is PostgreSQL 14+ valid. Every architectural decision is justified. Once signed off, this contract is FROZEN. No changes without explicit domain-wide impact analysis.

---

## PART 1: CROSS-CUTTING FOUNDATION

These decisions apply to every table, across every domain.

---

### 1.1 ID Strategy

**Decision**  
All primary keys use UUID v4.

**Implementation**
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**Invariant**
- Every record has a universally unique identifier
- IDs are not sequential (business scale not exposed)
- IDs are portable (no timezone/locale dependence)
- IDs never change

**Rationale**
- Supports future sharding/partitioning
- Privacy-preserving
- Compatible with distributed systems
- No database-generated sequences

**Exception**
None. Even foreign keys reference UUIDs.

---

### 1.2 Timestamp Strategy

**Decision**  
All timestamps stored as `TIMESTAMPTZ` in UTC. No timezone conversions in storage layer.

**Implementation**
```sql
-- All timestamps use this pattern
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ,
expires_at TIMESTAMPTZ
```

**NOT THIS** (incorrect):
```sql
-- WRONG: creates type mismatch
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() AT TIME ZONE 'UTC'
```

**Invariant**
- All timestamps are UTC-based absolute instants
- No local time stored in database
- `TIMESTAMPTZ` is the base type (equivalent to `TIMESTAMP WITH TIME ZONE`)
- Application displays in customer's timezone from `customer_preferences.timezone`

**Rationale**
- No ambiguity about when something happened
- Sortable across all records
- No DST confusion
- Historical accuracy

**Query Pattern**
```sql
-- Retrieve in customer's timezone
SELECT 
  created_at AT TIME ZONE pref.timezone AS local_created_at
FROM orders o
JOIN customer_preferences pref ON o.customer_id = pref.customer_id
WHERE o.id = $1;
```

---

### 1.3 Money/Currency Strategy

**Decision**  
Every monetary amount is paired with currency. Currency is explicit and immutable per transaction.

**Implementation**
```sql
-- WRONG: amount alone is insufficient
subtotal DECIMAL(15, 2)

-- RIGHT: amount + currency always together
subtotal_amount DECIMAL(15, 2) NOT NULL,
subtotal_currency VARCHAR(3) NOT NULL DEFAULT 'INR',

-- With constraint
CONSTRAINT valid_amount CHECK (subtotal_amount >= 0)
```

**Invariant**
- No monetary field exists without currency
- Currency is explicit (no implicit conversions)
- Amounts are non-negative (>= 0)
- Cross-transaction currency matching enforced by application/domain logic (not CHECK constraint)

**Rationale**
- Prevents cross-currency arithmetic bugs
- Supports multi-currency operations later
- ₹100 ≠ $100 ≠ €100 (explicit difference)
- Reduces calculation errors

**Precision**
Use `DECIMAL(15, 2)` for display/reporting. This is 13 digits + 2 decimal places = sufficient for commerce.

**NO implicit defaults**
```sql
-- WRONG: don't silently assume currency
amount DECIMAL(15, 2) DEFAULT 0

-- RIGHT: currency required
amount DECIMAL(15, 2) NOT NULL,
currency VARCHAR(3) NOT NULL -- no default, forces explicit setting
```

**Database Responsibility vs Application Responsibility**
```
Database (enforced via CHECK):
  ✅ Every monetary field has currency
  ✅ Amounts are non-negative
  
Application/Domain Logic (enforced in code):
  ✅ All line items in an order must match order currency
  ✅ Order total currency must match line items
  ✅ No cross-currency arithmetic without explicit conversion
  
Note: A single SQL CHECK constraint cannot validate that order.currency 
matches every order_line_item.currency. That requires application logic 
or triggers on insert/update.
```

---

### 1.4 Timezone Strategy

**Decision**  
System operates in UTC. User timezone is a preference.

**Implementation**
```sql
CREATE TABLE customer_preferences (
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata', -- IANA timezone
  ...
);
```

**Invariant**
- Database stores all times in UTC
- Display time = database time AT TIME ZONE customer_preferences.timezone
- No customer-local time in database

**Rationale**
- Internal consistency
- No confusion about what time something happened
- Respects user's local view

---

### 1.5 Phone Number Strategy

**Decision**  
Store phone numbers in E.164 canonical format. Application normalizes before persistence.

**Implementation**
```sql
-- Database stores canonical E.164: +[country code][subscriber number]
-- Example: +919876543210 (India), +14155552671 (US)
phone VARCHAR(20),

CONSTRAINT valid_phone 
  CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$')
```

**Invariant**
- Phone is always canonical E.164 or NULL
- Must start with + and country code
- Must be 8-15 digits (per E.164 standard)
- No spaces, parentheses, or hyphens stored

**Application Responsibility**
```typescript
// Input: user types "+91 9876 543210" or "9876543210"
// Application normalizes
const normalized = parsePhoneNumber(input, countryCode); // → "+919876543210"
// Save normalized form
await db.customers.update({phone: normalized});
```

**Display**
```typescript
// Database: +919876543210
// Display (per user locale): +91 9876 543210 or (91) 9876-543210
const formatted = formatPhoneNumber(dbPhone, userLocale);
```

**Rationale**
- Canonical storage (no ambiguity)
- International compatibility
- Prevents duplicate detection errors
- SMS/WhatsApp APIs require E.164

---

### 1.6 Deletion & Retention Strategy

**Decision**  
Use three retention classes based on data type.

**Implementation**

```
Class A: Business Records (Soft Delete)
├─ customers
├─ customer_addresses
├─ orders
├─ order_line_items
├─ products
└─ etc.
    Deletion: deleted_at TIMESTAMPTZ (never hard delete)
    Retention: permanent (never deleted)
    Rationale: Financial/legal audit trail

Class B: Ephemeral Auth Data (Hard Purge)
├─ sessions
├─ verification_tokens
├─ password_reset_tokens
└─ refresh_tokens (future)
    Deletion: hard delete after expiry/revocation
    Retention: 30-90 days (configurable)
    Rationale: Security (don't keep sensitive material)

Class C: Audit Records (Immutable Append-Only)
├─ customer_consents (DB mutation-protected in Core v2.1 via trigger)
└─ audit_logs (append-only design; full immutability protection planned)
    Deletion: append-only, mutation-protected where implemented
    Retention: governed by platform's legal/compliance retention policy
    Rationale: Compliance requires immutable history; retention duration
               determined by jurisdiction, data type, and legal basis
    
    Note: Core v2.1 implements DB-level immutability specifically for 
    customer_consents (mandatory for legal compliance). audit_logs design 
    is append-only but will receive explicit mutation-blocking triggers 
    in a future release. analytics_events are not part of Core v2.1.
```

**Invariant**
- Class A: deleted_at IS NULL OR IS NOT NULL (no physical deletion)
- Class B: hard purge after TTL (physical deletion ok)
- Class C: append-only (no updates, no deletes)

**Rationale**
- Different data types have different regulatory requirements
- Business records = financial audit trail (keep forever)
- Auth data = security (purge after expiry)
- Audit trail = compliance (immutable)

**Soft Delete Implementation**
```sql
-- Business record with soft delete
CREATE TABLE customers (
  ...
  deleted_at TIMESTAMPTZ
);

-- Unique index excludes deleted rows (correct PostgreSQL syntax)
CREATE UNIQUE INDEX uq_customers_email_active 
  ON customers(email_normalized) WHERE deleted_at IS NULL;

-- Default queries only return active
SELECT * FROM customers WHERE deleted_at IS NULL;

-- Soft delete operation
UPDATE customers SET deleted_at = NOW() WHERE id = $1;

-- Restore (sets deleted_at back to NULL)
UPDATE customers SET deleted_at = NULL WHERE id = $1;
```

**Hard Purge Implementation**
```sql
-- Ephemeral token with hard delete
CREATE TABLE sessions (
  ...
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

-- Cleanup job (runs daily)
DELETE FROM sessions
WHERE (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '90 days')
   OR (expires_at < NOW() - INTERVAL '30 days');
```

**Immutable ≠ Permanent**
Class C tables are **mutation-protected** (not updatable), but not necessarily **permanently retained**:
- Immutable: Row cannot be modified once written (enforced by database)
- Retention: How long to keep the row (governed by policy/compliance)

Examples:
- **GDPR right to be forgotten**: Customer can request deletion of consents/audit logs after statutory period
- **Data minimization**: Retain logs for 7 years (tax records) or 2 years (marketing), then purge
- **HIPAA/PCI**: Different retention windows per data type

The database enforces immutability (no UPDATE/DELETE triggers allowed). The platform enforces retention policy (scheduled purge jobs after retention window expires).

---

### 1.7 Audit Strategy

**Decision**  
Every table has `created_at`/`updated_at`. Sensitive mutations logged separately.

**Implementation**
```sql
-- All tables include
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

-- Sensitive operations logged to
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was changed
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  
  -- Who did it
  actor_id UUID,
  actor_type VARCHAR(50) NOT NULL, -- 'customer', 'staff', 'system'
  
  -- What changed
  action VARCHAR(50) NOT NULL, -- 'insert', 'update', 'delete'
  changes JSONB, -- {field: {old: ..., new: ...}}
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- When
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Sensitive Operations** (must log):
- Email change
- Password change
- Credentials modified
- Address modified
- Order status changed
- Refund issued
- Staff member created/deleted
- Permissions changed
- Payment authorization
- Inventory adjustments

**Implementation Pattern**
Application code triggers audit_logs insert on sensitive operations.
```typescript
// Example
async changeEmail(customerId: UUID, newEmail: string) {
  // 1. Change email
  await db.customers.update(customerId, {email: newEmail});
  
  // 2. Log audit
  await db.auditLogs.insert({
    actor_id: currentUser.id,
    action: 'email_changed',
    changes: {email: {old: customer.email, new: newEmail}},
    ip_address: request.ip,
    user_agent: request.headers['user-agent']
  });
}
```

---

### 1.8 Store Ownership Strategy

**Decision**  
Every record belongs to exactly one store. Store ownership is immutable.

**Implementation**
```sql
-- Child table has store_id
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  
  -- For stronger integrity: composite FK
  UNIQUE (id, store_id)
);

-- Where parent/child relationship must preserve same store
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  
  -- Composite FK: both id and store_id reference parent
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE
);
```

**Invariant**
- Every business record has store_id
- store_id is immutable (set at creation, never changed)
- Where parent/child relationship exists, composite FKs ensure same_store invariant
- A record cannot reference a parent from a different store

**Rationale**
- Single store now, multi-tenant foundation later
- Eliminates ambiguous "which store owns this?"
- Composite FKs provide database-level isolation (not just application-level)
- Prevents accidental cross-store relationships

**Application Responsibility**
Every query includes store_id filter.
```typescript
// WRONG: misses store context
const customer = await db.query('SELECT * FROM customers WHERE id = $1', [id]);

// RIGHT: includes store isolation
const customer = await db.query(
  'SELECT * FROM customers WHERE id = $1 AND store_id = $2',
  [id, storeId]
);
```

---

### 1.9 Store Isolation Strategy

**Decision**  
Application-enforced tenant isolation. PostgreSQL RLS not currently enabled.

**Implementation**
- Every service/repository requires `storeId` context
- Every query filters on `store_id`
- No global queries (impossible to access without store)

**NOT PostgreSQL Row-Level Security (RLS)**
PostgreSQL RLS uses `CREATE POLICY` and is powerful but complex. We're using simpler application-layer isolation.

```typescript
// Repository pattern
class CustomerRepository {
  // WRONG: no store isolation
  async findById(customerId: UUID) { }
  
  // RIGHT: store context required
  async findById(storeId: UUID, customerId: UUID) {
    return db.query(
      'SELECT * FROM customers WHERE id = $1 AND store_id = $2',
      [customerId, storeId]
    );
  }
}
```

**Testing Requirement**
Every repository test must verify isolation.
```typescript
test('customer from store A should not access customer from store B', async () => {
  const storeA = await createStore();
  const storeB = await createStore();
  const customerA = await createCustomer(storeA);
  
  const result = await repo.findById(storeB.id, customerA.id);
  expect(result).toBeNull(); // ✅ isolation verified
});
```

**Future Path**
If tenancy requirements evolve, PostgreSQL RLS can be layered on top without changing application logic.

---

### 1.10 Data Classification Strategy

**Decision**  
Every field is classified as one of five types.

**Classification**

```
SOURCE OF TRUTH
  ↓ Example: customer email, order total, product SKU
  ↓ Mutable: rarely (correctional only)
  ↓ Strategy: never delete, soft-delete only
  ↓ Audit: changed values logged

CACHE
  ↓ Example: catalog availability cache, analytics aggregates
  ↓ Mutable: frequently (based on transactions)
  ↓ Strategy: derived from transactions, rebuild on demand
  ↓ Audit: not logged (derived, not source)
  ↓ Note: Not part of Core v2.1 source-of-truth tables. Will appear in Catalog, Orders, and Analytics domains.

AUDIT HISTORY
  ↓ Example: audit_logs, customer_consents, analytics_events
  ↓ Mutable: never (immutable append-only)
  ↓ Strategy: write-once, never update or delete
  ↓ Audit: all entries are audit (self-referential)

EPHEMERAL DATA
  ↓ Example: sessions, verification tokens, refresh tokens
  ↓ Mutable: yes (status changes), then deleted
  ↓ Strategy: hard purge after expiry/revocation
  ↓ Audit: not logged (security data, don't store)

DERIVED/COMPUTED
  ↓ Example: order.total = subtotal + tax + shipping - discount
  ↓ Mutable: never (computed, not stored)
  ↓ Strategy: computed at query time or stored as constraint
  ↓ Audit: not logged (derived)
```

**Invariant**
Every field belongs to exactly one classification. Mixing violates contract.

**Example: Customers Table (Core Domain v2.1)**

| Field | Classification | Rationale |
|-------|-----------------|-----------|
| `id` | SOURCE OF TRUTH | Customer identity, immutable |
| `email_normalized` | SOURCE OF TRUTH | Login key, rarely changes |
| `first_name`, `last_name` | SOURCE OF TRUTH | Profile info, mutable |
| `status` | SOURCE OF TRUTH | Operational state |
| `email_verified` | SOURCE OF TRUTH | Verification flag |
| `created_at` | SYSTEM METADATA | Immutable creation timestamp |
| `updated_at` | SYSTEM METADATA | Mutable last-modified timestamp |
| `deleted_at` | LIFECYCLE METADATA | Soft-delete state (NULL=active, set=deleted, may be reset for restore) |

**Note**: `total_spent` and order count metrics are NOT in customers table (Core v2.1). They are computed from orders table or stored in a separate metrics/analytics table.

**Timestamp Clarification**
- `created_at`: Set once at insert, never changes (immutable historical)
- `updated_at`: Updated on every row modification (mutable operational)
- `deleted_at`: Mutable lifecycle state—set to NOW() on soft delete, may be set back to NULL to restore active record

---

### 1.11 Naming & Conventions

**Naming Pattern**
```
Singular, snake_case
customers (not customer_accounts)
customer_addresses (not addresses)
email_normalized (not normalized_email)
is_active (not active_status)

Money fields
<field>_amount (price_amount, total_amount)
<field>_currency (price_currency, total_currency)

Status fields
status VARCHAR(50) -- no "is_" prefix
Boolean flags (rare): is_active, is_default, is_verified
```

**Foreign Keys**
```
<parent_table_singular>_id
customer_id (not customerId)
store_id (not storeId)
```

**Indexes**
```
idx_<table>_<column>          -- single column
idx_<table>_<col1>_<col2>     -- composite
uq_<table>_<column>           -- unique index
idx_<table>_<column>_partial  -- where condition included in name
```

**Constraints**
```
Unique: uq_<table>_<column>
Check: ck_<table>_<rule>
FK: fk_<child>_<parent>
```

---

## PART 2: STORE (Root Boundary)

---

### 2.1 stores

**Purpose**
Root business boundary. One instance = Faded Chapter (today). Foundation for multi-store/multi-tenant (future).

**SQL**
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  domain VARCHAR(255),
  
  -- Contact
  owner_email VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- ENUM: active, suspended, closed
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_name CHECK (LENGTH(name) > 0),
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9\-]+$'),
  CONSTRAINT valid_email CHECK (owner_email ~ '^[^@]+@[^@]+$')
);

CREATE UNIQUE INDEX uq_stores_slug ON stores(slug);
CREATE UNIQUE INDEX uq_stores_domain ON stores(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_stores_status ON stores(status);
```

**Data Classification**
- `id`: SOURCE OF TRUTH (immutable identity)
- `name`, `slug`, `domain`: SOURCE OF TRUTH (mutable rarely)
- `status`: SOURCE OF TRUTH (operational state)
- `created_at`: AUDIT HISTORY (immutable)
- `updated_at`: AUDIT HISTORY (immutable)

**Invariants**
- `name` non-empty
- `slug` unique, lowercase alphanumeric + hyphen
- `domain` optional, unique if set
- `status` one of enum values
- Identity immutable (never change `id` or `slug`)

**Note**
Branding, currency, timezone moved to `store_settings` (see 2.2).

---

### 2.2 store_settings

**Purpose**
Store operational configuration, separate from identity.

**SQL**
```sql
CREATE TABLE store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Default operational settings
  default_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  default_timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  default_locale VARCHAR(10) NOT NULL DEFAULT 'en-IN',
  
  -- Features
  guest_checkout_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  customer_accounts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_verification_required BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Ordering
  order_number_prefix VARCHAR(10) DEFAULT '',
  order_number_start INTEGER DEFAULT 1001,
  
  -- Inventory
  inventory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Tax
  tax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Maintenance
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT,
  
  -- Extension
  settings_json JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_currency CHECK (default_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT valid_locale CHECK (default_locale ~ '^[a-z]{2}-[A-Z]{2}$')
);

CREATE UNIQUE INDEX uq_store_settings_store_id ON store_settings(store_id);
```

**Data Classification**
- All fields: SOURCE OF TRUTH (mutable)
- `created_at`, `updated_at`: AUDIT HISTORY

**Invariants**
- One settings record per store
- Currency valid ISO 4217 code
- Locale valid language-region format
- Booleans default to reasonable values

---

## PART 3: CUSTOMER (Identity & Account)

---

### 3.1 customers

**Purpose**
Customer account identity. Core record for all customer-related data.

**SQL**
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  
  -- Contact
  email VARCHAR(255) NOT NULL,
  email_normalized VARCHAR(255) NOT NULL,
  
  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  
  -- Account status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- ENUM: active, inactive, banned
  
  -- Email verification
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  
  -- Composite FK for stronger ownership
  UNIQUE (id, store_id),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_email 
    CHECK (email ~ '^[^@]+@[^@]+$'),
  
  CONSTRAINT valid_phone 
    CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
  
  CONSTRAINT email_verified_consistency 
    CHECK (
      (email_verified = TRUE AND email_verified_at IS NOT NULL) OR
      (email_verified = FALSE AND email_verified_at IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE UNIQUE INDEX uq_customers_store_email_active 
  ON customers(store_id, email_normalized) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_status ON customers(store_id, status);
CREATE INDEX idx_customers_created_at ON customers(store_id, created_at DESC);
```

**Data Classification**
- `id`, `store_id`: SOURCE OF TRUTH (immutable)
- `email_normalized`: SOURCE OF TRUTH (rarely changes)
- `first_name`, `last_name`, `phone`: SOURCE OF TRUTH
- `status`: SOURCE OF TRUTH
- `email_verified`: SOURCE OF TRUTH
- `created_at`, `deleted_at`: AUDIT HISTORY (immutable)

**Invariants**
- Email unique per store (active only)
- Email normalized (lowercase, trimmed)
- `email_verified` and `email_verified_at` consistent
- Can only soft-delete, not hard-delete
- Composite FK `(id, store_id)` for integrity

**Why Composite FK**
Ensures that related records (addresses, credentials, sessions) can validate they belong to same store.

**Note: Cached Metrics Removed**
`total_orders`, `total_spent`, `last_order_at` are NOT in this table. They belong in a separate metrics table or are computed at query time. This keeps the customer record as source-of-truth identity only.

---

### 3.2 customer_addresses

**Purpose**
Reusable mutable addresses. Customer can update at any time.

**SQL**
```sql
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  
  -- Composite FK ensures same store
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE,
  
  -- Address type
  type VARCHAR(20) NOT NULL DEFAULT 'shipping',
    -- ENUM: shipping, billing
  
  -- Contact
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  
  -- Address
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country_code VARCHAR(2) NOT NULL,
  
  -- Flags
  is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,
  label VARCHAR(100), -- "Home", "Office"
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_address 
    CHECK (
      LENGTH(first_name) > 0 AND
      LENGTH(last_name) > 0 AND
      LENGTH(address_line_1) > 0 AND
      LENGTH(city) > 0 AND
      LENGTH(country_code) = 2
    ),
  
  CONSTRAINT valid_phone 
    CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
  
  CONSTRAINT valid_defaults 
    CHECK (
      (is_default_shipping = TRUE AND is_default_billing = FALSE) OR
      (is_default_shipping = FALSE AND is_default_billing = TRUE) OR
      (is_default_shipping = TRUE AND is_default_billing = TRUE) OR
      (is_default_shipping = FALSE AND is_default_billing = FALSE)
    )
);

-- Indexes
CREATE INDEX idx_customer_addresses_store_id ON customer_addresses(store_id);
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE UNIQUE INDEX uq_customer_default_shipping 
  ON customer_addresses(customer_id) 
  WHERE is_default_shipping = TRUE;
CREATE UNIQUE INDEX uq_customer_default_billing 
  ON customer_addresses(customer_id) 
  WHERE is_default_billing = TRUE;
```

**Data Classification**
- All address fields: SOURCE OF TRUTH (mutable by customer)
- `created_at`, `updated_at`: AUDIT HISTORY

**Invariants**
- Composite FK ensures customer and address belong to same store
- One default shipping address per customer (unique index)
- One default billing address per customer (unique index)
- Can be both shipping and billing (same address)
- Address fields required (non-null)
- Country code 2 characters (ISO 3166-1)

**Why Not in Customers Table**
Addresses are mutable and customers can have multiple. Separate table allows:
- Customer adds new address without updating customer record
- Clean separation of concerns
- Historical snapshots in Orders table (not mutable references)

---

### 3.3 customer_preferences

**Purpose**
Customer settings: communication preferences, display preferences.

**SQL**
```sql
CREATE TABLE customer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  
  -- Composite FK ensures customer and preferences belong to same store
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE,
  
  -- Communication preferences
  email_order_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  email_order_updates BOOLEAN NOT NULL DEFAULT TRUE,
  email_promotions BOOLEAN NOT NULL DEFAULT FALSE,
  email_newsletter BOOLEAN NOT NULL DEFAULT FALSE,
  
  sms_order_updates BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Display preferences
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  
  -- Shopping behavior
  save_payment_method BOOLEAN NOT NULL DEFAULT TRUE,
  auto_apply_rewards BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Extension
  custom_settings JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_language CHECK (language ~ '^[a-z]{2}$')
);

CREATE UNIQUE INDEX uq_customer_preferences_customer_id ON customer_preferences(customer_id);
```

**Data Classification**
- All fields: SOURCE OF TRUTH (mutable)
- `created_at`, `updated_at`: AUDIT HISTORY

**Invariants**
- One preference record per customer
- Language valid ISO 639-1 code
- All booleans have sensible defaults

**Separation from Consent**
These are PREFERENCES (current choices), not LEGAL CONSENT (audit trail). Legal consent goes in `customer_consents` table (see 3.4).

---

### 3.4 customer_consents

**Purpose**
AUDIT HISTORY of legal/marketing consent. Immutable append-only.

**SQL**
```sql
CREATE TABLE customer_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  
  -- Composite FK ensures customer and consents belong to same store
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE RESTRICT,
  
  -- Consent type
  consent_type VARCHAR(100) NOT NULL,
    -- ENUM: marketing_email, marketing_sms, analytics, newsletter, terms_of_service
  
  -- State
  granted BOOLEAN NOT NULL,
  
  -- Legal metadata
  policy_version VARCHAR(50), -- e.g., "v1.0", "2024-01"
  policy_url VARCHAR(512),
  
  -- Context
  source VARCHAR(50) NOT NULL,
    -- ENUM: signup, preference_page, email_link, api
  
  ip_address INET,
  user_agent TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Immutable (enforced via trigger)
  CONSTRAINT valid_context CHECK (source IS NOT NULL)
);

-- Prevent any mutations (updates/deletes) via trigger
CREATE OR REPLACE FUNCTION prevent_customer_consent_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'customer_consents is append-only: updates and deletes are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_customer_consent_update
BEFORE UPDATE OR DELETE ON customer_consents
FOR EACH ROW
EXECUTE FUNCTION prevent_customer_consent_mutation();

-- Indexes for query performance
CREATE INDEX idx_customer_consents_customer_id ON customer_consents(customer_id);
CREATE INDEX idx_customer_consents_lookup 
  ON customer_consents(store_id, customer_id, consent_type, created_at DESC);
```

**Data Classification**
Everything: AUDIT HISTORY (immutable append-only)

**Invariants**
- Once inserted, never updated or deleted
- Tracks every consent decision (both granted and revoked)
- Records context: IP, user agent, source
- Includes policy version for compliance

**Usage Pattern**
```typescript
// Get current consent state
const currentConsent = await db.query(`
  SELECT granted FROM customer_consents
  WHERE customer_id = $1 AND consent_type = 'marketing_email'
  ORDER BY created_at DESC
  LIMIT 1
`, [customerId]);

// Record new consent decision (append-only)
await db.customerConsents.insert({
  id: generateUUID(),
  store_id: storeId,
  customer_id: customerId,
  consent_type: 'marketing_email',
  granted: true,
  source: 'preference_page',
  ip_address: request.ip,
  user_agent: request.headers['user-agent'],
  policy_version: 'v1.0',
  created_at: new Date()
});

// Optionally log the operation to audit_logs for operational tracking
await db.auditLogs.insert({
  action: 'consent_recorded',
  table_name: 'customer_consents',
  actor_id: currentUserId,
  changes: {consent_type: 'marketing_email', granted: true}
});
```

**Why Separate from Preferences**
- Preferences = current choices (mutable)
- Consents = legal audit trail (immutable)
- Compliance requires timestamped history of consent decisions
- If customer revokes consent later, we still have history that they previously consented

---

## PART 4: IDENTITY & AUTHENTICATION

---

### 4.1 customer_credentials

**Purpose**
Password storage. NEVER visible to customer, NEVER transmitted to client.

**SQL**
```sql
CREATE TABLE customer_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  
  -- Composite FK ensures customer and credentials belong to same store
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE,
  
  -- Password (bcrypt hash only, never plaintext)
  password_hash VARCHAR(255) NOT NULL,
  
  -- Metadata
  hash_algorithm VARCHAR(50) NOT NULL DEFAULT 'bcrypt',
  hash_version INTEGER NOT NULL DEFAULT 1,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Security tracking
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_changed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_hash CHECK (LENGTH(password_hash) > 0),
  CONSTRAINT valid_attempts CHECK (failed_login_attempts >= 0)
);

CREATE UNIQUE INDEX uq_customer_credentials_customer_id ON customer_credentials(customer_id);
```

**Data Classification**
- `password_hash`: SOURCE OF TRUTH (immutable until change)
- `is_active`: SOURCE OF TRUTH
- Security tracking fields: SOURCE OF TRUTH
- `created_at`, `password_changed_at`: AUDIT HISTORY

**Invariants**
- Never store plaintext password
- `password_hash` non-empty
- `failed_login_attempts` >= 0
- Account locked if `locked_until > NOW()`
- bcrypt hash length = 60 characters (always)

**Security Rules**
- NEVER query this table without authentication context
- NEVER return `password_hash` to client
- Hash algorithm in table allows future migration (bcrypt → scrypt)
- Implement account lockout after N failed attempts

**Separate Table Rationale**
- Isolates sensitive data
- Allows customers table to be read freely (addresses, preferences)
- Credentials require special access controls

---

### 4.2 sessions

**Purpose**
Authenticated sessions. Revocable, multi-device.

**SQL**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  
  -- Composite FK ensures session and customer belong to same store
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE,
  
  -- Token (HASH ONLY, never raw token)
  token_hash VARCHAR(255) NOT NULL,
  
  -- Device info
  ip_address INET NOT NULL,
  user_agent TEXT,
  device_type VARCHAR(50), -- ENUM: web, mobile, desktop
  device_name VARCHAR(255),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Validity
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT revoked_logic CHECK (
    (revoked_at IS NULL AND is_active = TRUE) OR
    (revoked_at IS NOT NULL AND is_active = FALSE)
  )
);

-- Indexes
CREATE INDEX idx_sessions_customer_id ON sessions(customer_id);
CREATE UNIQUE INDEX uq_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_active ON sessions(customer_id, is_active) 
  WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) 
  WHERE is_active = TRUE;
```

**Data Classification**
- `token_hash`: SOURCE OF TRUTH (immutable)
- `is_active`, `revoked_at`: SOURCE OF TRUTH
- `created_at`, `expires_at`, `last_activity_at`: AUDIT HISTORY

**Invariants**
- `expires_at` > `created_at`
- If revoked, must have `revoked_at`
- If active, must not have `revoked_at`
- `token_hash` unique
- No raw bearer token stored

**CRITICAL: Never Store Raw Token**

```typescript
// WRONG: exposes token if DB is compromised
session.token = "raw-bearer-token-xyz";
await db.sessions.insert(session);

// RIGHT: store hash only
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
session.token_hash = tokenHash;
await db.sessions.insert(session);

// Client receives raw token
return { token: rawToken }; // ← client stores this

// Verify token at login
const tokenHash = crypto.createHash('sha256').update(providedToken).digest('hex');
const session = await db.query(
  'SELECT * FROM sessions WHERE token_hash = $1',
  [tokenHash]
);
```

**Lifecycle**
```
Created (is_active=TRUE, revoked_at=NULL)
   ↓
[used, last_activity_at updated]
   ↓
Expired (expires_at < now) OR Revoked (revoked_at set, is_active=FALSE)
```

---

### 4.3 verification_tokens

**Purpose**
One-time tokens for email verification. Expire after 24 hours.

**SQL**
```sql
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  
  -- Composite FK ensures token and customer belong to same store
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE,
  
  -- Token (HASH ONLY)
  token_hash VARCHAR(255) NOT NULL,
  
  -- Purpose
  purpose VARCHAR(50) NOT NULL DEFAULT 'email_verification',
  
  -- Email being verified
  email VARCHAR(255) NOT NULL,
  
  -- Lifecycle
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_token CHECK (LENGTH(token_hash) > 0),
  CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+$'),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT consumed_logic CHECK (
    (consumed_at IS NULL) OR (consumed_at <= expires_at)
  )
);

-- Indexes (NO NOW() in predicates)
CREATE UNIQUE INDEX uq_verification_tokens_hash ON verification_tokens(token_hash);
CREATE INDEX idx_verification_tokens_customer_id ON verification_tokens(customer_id);
CREATE INDEX idx_verification_tokens_expires_at ON verification_tokens(expires_at);
```

**Data Classification**
- `token_hash`: SOURCE OF TRUTH (immutable)
- `consumed_at`: SOURCE OF TRUTH
- `created_at`, `expires_at`: AUDIT HISTORY

**Invariants**
- Token hashed (never raw token in DB)
- One-time use only (`consumed_at` is null until used)
- Must expire
- Query checks: `consumed_at IS NULL AND expires_at > NOW()`

**Why Simplified Lifecycle**
Instead of `is_used` + `used_at` (redundant boolean + timestamp), just use `consumed_at`:
- `consumed_at IS NULL` = usable
- `consumed_at IS NOT NULL` = consumed

**Hard Purge Policy**
Delete after 30 days (retained for recovery audit, then purged for security).

---

### 4.4 password_reset_tokens

**Purpose**
One-time tokens for password reset. Expire after 24 hours. Brute-force protected.

**SQL**
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  
  -- Composite FK ensures token and customer belong to same store
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE,
  
  -- Token (HASH ONLY)
  token_hash VARCHAR(255) NOT NULL,
  
  -- Email requesting reset
  email VARCHAR(255) NOT NULL,
  
  -- Lifecycle
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Brute force protection
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Audit
  requested_ip_address INET,
  used_ip_address INET,
  
  -- Constraints
  CONSTRAINT valid_token CHECK (LENGTH(token_hash) > 0),
  CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+$'),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT valid_attempts CHECK (attempt_count >= 0 AND attempt_count <= max_attempts),
  CONSTRAINT consumed_logic CHECK (
    (consumed_at IS NULL) OR (consumed_at <= expires_at)
  )
);

-- Indexes
CREATE UNIQUE INDEX uq_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_customer_id ON password_reset_tokens(customer_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

**Data Classification**
- `token_hash`, `attempt_count`: SOURCE OF TRUTH
- `consumed_at`: SOURCE OF TRUTH
- Timestamps: AUDIT HISTORY

**Invariants**
- Token hashed
- One-time use (`consumed_at` null until used)
- Max 3 attempts before disabled
- Must expire
- Attempt count tracks brute-force attempts

**Note: DB-Level Brute Force is Defense-in-Depth**
Primary brute-force protection is application/rate-limit layer:
- IP rate limiting
- Email rate limiting
- CAPTCHA challenges
This DB `attempt_count` is secondary defense.

**Hard Purge Policy**
Delete after 30 days (security data, don't keep indefinitely).

---

## PART 5: CROSS-DOMAIN INTEGRITY

---

### 5.1 Composite Foreign Key Strategy

**Decision**
Where parent/child must maintain store ownership invariant, use composite foreign keys.

**Pattern**
```sql
-- Parent
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  UNIQUE (id, store_id)
);

-- Child
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  
  FOREIGN KEY (customer_id, store_id) 
    REFERENCES customers(id, store_id) ON DELETE CASCADE
);
```

**Invariant**
`customer_addresses.store_id == customers.store_id` (enforced by FK)

**Why Not Just Application Check**
```
Database-enforced: Impossible for addresses to belong to different store than customer
Application-only: Relies on every developer always filtering by store_id
```
Database enforcement is stronger.

**When to Use Composite FKs**
- Parent/child where store ownership must align
- Do NOT use everywhere (creates maintenance overhead)
- Use for critical business relationships

**Applied In**
- customers ← customer_addresses
- customers ← customer_credentials
- customers ← customer_preferences
- customers ← customer_consents
- customers ← sessions
- customers ← verification_tokens
- customers ← password_reset_tokens

---

### 5.2 Uniqueness Strategy

**Decision**
Partial UNIQUE constraints use UNIQUE INDEXES, not table constraints.

**Pattern**
```sql
-- WRONG: PostgreSQL does not support this
CREATE TABLE customers (
  CONSTRAINT unique_active_email UNIQUE (email_normalized) WHERE deleted_at IS NULL
);

-- RIGHT: Use unique index
CREATE UNIQUE INDEX uq_customers_store_email_active 
  ON customers(store_id, email_normalized) WHERE deleted_at IS NULL;
```

**Invariant**
- Only one non-deleted customer per email per store
- Index automatically enforced by PostgreSQL

**Applied Throughout**
- Unique emails per store (soft delete aware)
- Unique default addresses (shipping/billing flags)
- Unique store_id tokens (sessions, verification tokens)

---

### 5.3 Deletion/Retention Policy

**Decision**
Three classes of data, three retention strategies.

**Class A: Business Records (Soft Delete)**
- Tables: customers, customer_addresses, orders, etc.
- Deletion: `deleted_at` timestamp (never hard delete)
- Retention: permanent
- Reason: Financial/legal audit trail

**Class B: Ephemeral Auth Data (Hard Purge)**
- Tables: sessions, verification_tokens, password_reset_tokens
- Deletion: hard delete after TTL
- Retention: 30-90 days
- Reason: Security (don't keep sensitive material)

**Class C: Audit Records (Immutable Append-Only)**
- Tables: audit_logs, customer_consents, analytics_events
- Deletion: never delete
- Retention: permanent
- Reason: Compliance (immutable history)

**Implementation**
```sql
-- Class A: Soft delete
UPDATE customers SET deleted_at = NOW() WHERE id = $1;
SELECT * FROM customers WHERE deleted_at IS NULL; -- active only

-- Class B: Hard purge (automatic job)
DELETE FROM sessions
WHERE expires_at < NOW() - INTERVAL '30 days';

-- Class C: Immutable
INSERT INTO customer_consents (...); -- insert only
-- UPDATE customer_consents ... -- forbidden
-- DELETE FROM customer_consents ... -- forbidden
```

---

### 5.4 ON DELETE Behavior

**Decision**
Choose FK behavior based on data class.

**Policy**
```
Business Records (soft delete)
  → ON DELETE RESTRICT (require explicit soft delete)

Ephemeral Data (hard purge)
  → ON DELETE CASCADE (ok to hard delete)

Audit Records
  → ON DELETE RESTRICT (never delete)
```

**Rationale**
- RESTRICT forces explicit thinking (can't accidentally purge)
- CASCADE ok for ephemeral (expired tokens can disappear)
- Audit records never cascade-deleted

---

## PART 6: SECURITY REQUIREMENTS

---

### 6.1 Credential Handling

**Requirement**
Never store plaintext passwords. Always bcrypt (or scrypt) hash.

**Implementation**
```typescript
// Never this
password: "MyPassword123!"

// Always this
password_hash: bcrypt.hashSync(password, 10) // 10 rounds, 60 chars
```

**Rotation**
Store `hash_algorithm` and `hash_version` to support future migration:
```sql
hash_algorithm: 'bcrypt' (future: 'scrypt')
hash_version: 1 (future: 2 if algorithm changes)
```

---

### 6.2 Token Handling

**Requirement**
Never store raw bearer tokens. Store hash only.

**Implementation**
```typescript
// Token creation
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
session.token_hash = tokenHash;
await db.sessions.insert(session);

return { token: rawToken }; // ← only client gets raw token

// Token verification
const providedToken = request.headers.authorization.split(' ')[1];
const tokenHash = crypto.createHash('sha256').update(providedToken).digest('hex');
const session = await db.query(
  'SELECT * FROM sessions WHERE token_hash = $1 AND is_active = TRUE',
  [tokenHash]
);
```

**Why**
If database is compromised, attacker does NOT get usable bearer tokens (just hashes).

---

### 6.3 Session Security

**Requirement**
Sessions revocable, expiring, multi-device aware.

**Implementation**
- Store device info (IP, user agent, device name)
- Track last activity
- Implement logout (revoke)
- Expire after N hours
- Detect anomalies (new device, new IP)

---

### 6.4 Rate Limiting Responsibility

**Requirement**
Rate limiting is APPLICATION layer, not database.

**Mechanism**
```typescript
// Application middleware
const rateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyGenerator: (req) => req.ip
});

app.post('/api/password/forgot', rateLimiter, passwordForgotHandler);
```

**Database Supports** (not replaces) via:
- `attempt_count` on password reset tokens
- `failed_login_attempts` on credentials

---

### 6.5 Sensitive Data Rules

**Rule: Never Log Passwords**
```typescript
// WRONG
logger.info(`User ${user.email} logged in with password ${password}`);

// RIGHT
logger.info(`User ${user.email} logged in`);
```

**Rule: Never Log Raw Tokens**
```typescript
// WRONG
logger.info(`Created session token: ${rawToken}`);

// RIGHT
logger.info(`Created session ${tokenHash.slice(0, 8)}...`);
```

**Rule: Never Send Credentials to Client**
```typescript
// WRONG
res.json({ user: { password_hash: '...' } });

// RIGHT
res.json({ user: { email, id, created_at } });
```

---

## PART 7: FROZEN CONTRACT

---

### 7.1 Schema Summary

```
TOTAL TABLES:  11
TOTAL FIELDS:  ~150
TOTAL INDEXES: ~30
TOTAL CONSTRAINTS: 50+

Core Domain Tables:
1. stores
2. store_settings
3. customers
4. customer_addresses
5. customer_preferences
6. customer_consents
7. customer_credentials
8. sessions
9. verification_tokens
10. password_reset_tokens
11. audit_logs
```

---

### 7.2 Key Invariants

**Store Ownership**
- Every record has store_id
- store_id immutable
- Composite FKs enforce same-store relationships

**Email Uniqueness**
- Per store, active customers only
- email_normalized for lookups

**One-Time Tokens**
- consumed_at tracks usage
- Cannot use twice
- Expire after 24 hours

**Soft Delete**
- Business records: deleted_at timestamp
- Never hard delete
- Unique indexes respect deleted_at IS NULL

**Password Security**
- Never plaintext
- Always bcrypt hash
- Separate table from customer profile

**Session Lifecycle**
- Created → Active → Expired/Revoked
- Multi-device support
- Revocation via is_active=false

**Consent Audit**
- Immutable append-only
- Every decision tracked
- Compliance-ready

---

### 7.3 Data Classifications

**SOURCE OF TRUTH**: customer.email, credentials.password_hash, address fields  
**CACHE**: (none in Core, reserved for Catalog/Orders)  
**AUDIT HISTORY**: created_at, updated_at, deleted_at, audit_logs  
**EPHEMERAL**: sessions, tokens (hard purge after expiry)  
**CONSENT AUDIT**: customer_consents (immutable)

---

### 7.4 Deferred Decisions

These are intentionally NOT in Core, reserved for later domains:

```
Catalog v2:
  ├─ Products
  ├─ Variants
  ├─ Categories
  └─ Attributes

Commerce v2:
  ├─ Cart
  ├─ Checkout
  └─ Orders
      └─ Address snapshots (separate from customer_addresses)
      └─ Product snapshots (separate from products)

Payments v2:
  ├─ Payment abstraction
  └─ Provider isolation

Inventory v2:
  ├─ Movement ledger
  └─ Stock levels
```

---

### 7.5 Approval Checklist

**For Core v2.1 to be FROZEN:**

- [ ] All 20 corrections incorporated
- [ ] PostgreSQL 14+ syntax verified
- [ ] Composite FKs in place
- [ ] Partial unique indexes correct
- [ ] TIMESTAMPTZ without AT TIME ZONE
- [ ] No NOW() in partial index predicates
- [ ] Data classifications clear
- [ ] No cached metrics in customers
- [ ] Customer consents separate from preferences
- [ ] Store settings separated from stores
- [ ] Session tokens never stored raw
- [ ] Token lifecycle simplified (no redundant booleans)
- [ ] Soft/hard delete policy defined
- [ ] Naming conventions consistent
- [ ] Security rules documented
- [ ] All indexes named properly
- [ ] All constraints named properly
- [ ] Email normalization rules explicit
- [ ] Phone E.164 ready (app layer)
- [ ] Currency always paired strategy clear

---

### 7.6 Next Phase Gate

**Core v2.1 is LOCKED when:**
1. This contract is approved
2. All SQL verified against PostgreSQL 14+
3. All invariants tested in application
4. No future changes to these 11 tables without cross-team approval

**Catalog v2 begins when:**
Core v2.1 is signed off.

---

## SIGNATURE

**Core v2.1 Database Contract**  
**Status**: ✅ Schema Complete — ⏳ Awaiting Final Approval  
**Created**: 2026-09-14  
**Last Updated**: 2026-09-14  
**Authority**: Database Architecture  

**This contract is not yet FROZEN.** All corrections have been applied and cross-checked. Final approval requires:
1. Explicit verification of all SQL against PostgreSQL 14+
2. Approval checklist signed off
3. Explicit FROZEN declaration by architecture authority

Once FROZEN, all subsequent domains must conform to this specification.

No breaking changes to Core permitted without explicit cross-domain approval.

**Freeze Status**: ⏳ Awaiting Final Verification & Sign-Off

---

**Document End**
