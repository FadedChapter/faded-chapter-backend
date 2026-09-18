# Faded Chapter: Database Schema Design

**Status**: 🎯 Schema Design Phase  
**Database**: PostgreSQL 14+  
**Purpose**: Complete data model for e-commerce platform  
**Approach**: Modular monolith with clear boundaries  

---

## 📊 Schema Overview

```
CORE DOMAIN
├─ Customers
│  ├─ Customer (customer)
│  ├─ CustomerAddress (customer_addresses)
│  ├─ CustomerPreference (customer_preferences)
│  └─ Session (sessions)
│
CATALOG DOMAIN
├─ Products
│  ├─ Product (products)
│  ├─ ProductVariant (product_variants)
│  ├─ ProductImage (product_images)
│  ├─ Collection (collections)
│  └─ CollectionProduct (collection_products)
│
COMMERCE DOMAIN
├─ Shopping
│  ├─ Cart (carts)
│  └─ CartItem (cart_items)
│
├─ Checkout
│  └─ Checkout (checkouts)
│
├─ Orders
│  ├─ Order (orders)
│  ├─ OrderLineItem (order_line_items)
│  ├─ OrderTimeline (order_timeline)
│  └─ OrderNote (order_notes)
│
├─ Payments
│  ├─ PaymentIntent (payment_intents)
│  ├─ PaymentMethod (payment_methods)
│  ├─ PaymentRefund (payment_refunds)
│  └─ PaymentWebhook (payment_webhooks)
│
FULFILLMENT DOMAIN
├─ Fulfillment
│  ├─ Fulfillment (fulfillments)
│  ├─ FulfillmentLineItem (fulfillment_line_items)
│  ├─ ShippingLabel (shipping_labels)
│  ├─ Return (returns)
│  └─ ReturnItem (return_items)
│
├─ Shipping
│  ├─ ShippingMethod (shipping_methods)
│  ├─ ShippingRule (shipping_rules)
│  ├─ ShippingRate (shipping_rates)
│  └─ InventoryLocation (inventory_locations)
│
INVENTORY DOMAIN
├─ Stock
│  ├─ InventoryLevel (inventory_levels)
│  ├─ InventoryAdjustment (inventory_adjustments)
│  └─ InventoryReservation (inventory_reservations)
│
PRICING DOMAIN
├─ Pricing
│  ├─ Price (prices)
│  ├─ PricingRule (pricing_rules)
│  └─ PriceList (price_lists)
│
PROMOTIONS DOMAIN
├─ Promotions
│  ├─ Promotion (promotions)
│  ├─ PromotionCode (promotion_codes)
│  └─ PromotionEligibility (promotion_eligibility)
│
MARKETING DOMAIN
├─ Email
│  ├─ EmailCampaign (email_campaigns)
│  ├─ EmailTemplate (email_templates)
│  ├─ EmailTrigger (email_triggers)
│  └─ EmailLog (email_logs)
│
├─ Segments
│  ├─ CustomerSegment (customer_segments)
│  ├─ SegmentRule (segment_rules)
│  └─ CustomerSegmentMembership (customer_segment_memberships)
│
├─ Loyalty
│  ├─ LoyaltyProgram (loyalty_programs)
│  ├─ LoyaltyTier (loyalty_tiers)
│  ├─ LoyaltyRule (loyalty_rules)
│  ├─ LoyaltyReward (loyalty_rewards)
│  ├─ CustomerLoyaltyProfile (customer_loyalty_profiles)
│  └─ PointsTransaction (points_transactions)
│
REVIEWS & CONTENT
├─ Reviews
│  ├─ ProductReview (product_reviews)
│  ├─ ReviewResponse (review_responses)
│  └─ ReviewImage (review_images)
│
ANALYTICS DOMAIN
├─ Events
│  ├─ AnalyticsEvent (analytics_events)
│  └─ AnalyticsSession (analytics_sessions)
│
├─ Reports
│  └─ CustomReport (custom_reports)
│
ADMIN DOMAIN
├─ Staff
│  ├─ StaffMember (staff_members)
│  ├─ Role (roles)
│  ├─ Permission (permissions)
│  └─ RolePermission (role_permissions)
│
├─ Audit
│  └─ ActivityLog (activity_logs)
│
INFRASTRUCTURE
└─ Webhooks (handled by payment domain)
```

---

## 🗂️ CORE DOMAIN SCHEMA

### 1.1 customers

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  email VARCHAR(255) NOT NULL UNIQUE,
  email_normalized VARCHAR(255) NOT NULL UNIQUE, -- lowercase for lookups
  
  -- Personal info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  
  -- Account status
  status VARCHAR(20) NOT NULL DEFAULT 'active', 
    -- ENUM: active, inactive, banned, deleted
  
  -- Email verification
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  
  -- Relationships
  default_shipping_address_id UUID,
  default_billing_address_id UUID,
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  custom_fields JSONB DEFAULT '{}'::JSONB,
  
  -- Metrics
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  last_order_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP, -- soft delete
  
  CONSTRAINT email_length CHECK (LENGTH(email) > 0),
  CONSTRAINT phone_format CHECK (phone IS NULL OR phone ~ '^\+?[0-9\s\-\(\)]+$')
);

CREATE INDEX idx_customers_email ON customers(email_normalized);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_customers_deleted_at ON customers(deleted_at) 
  WHERE deleted_at IS NULL;
```

---

### 1.2 customer_addresses

```sql
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Type
  type VARCHAR(20) NOT NULL DEFAULT 'shipping',
    -- ENUM: shipping, billing, both
  
  -- Address
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
  
  -- Metadata
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  label VARCHAR(100), -- "Home", "Work", etc
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_address CHECK (
    LENGTH(first_name) > 0 AND 
    LENGTH(address_line_1) > 0 AND 
    LENGTH(city) > 0
  )
);

CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_default ON customer_addresses(customer_id, is_default)
  WHERE is_default = TRUE;

-- Add foreign key from customers to default addresses
ALTER TABLE customers 
ADD CONSTRAINT fk_default_shipping_address 
FOREIGN KEY (default_shipping_address_id) 
REFERENCES customer_addresses(id) ON DELETE SET NULL;

ALTER TABLE customers 
ADD CONSTRAINT fk_default_billing_address 
FOREIGN KEY (default_billing_address_id) 
REFERENCES customer_addresses(id) ON DELETE SET NULL;
```

---

### 1.3 customer_preferences

```sql
CREATE TABLE customer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Communication preferences
  email_notifications JSONB DEFAULT '{
    "order_confirmation": true,
    "order_updates": true,
    "promotions": true,
    "newsletter": false,
    "abandoned_cart": true
  }'::JSONB,
  
  sms_notifications JSONB DEFAULT '{
    "order_updates": false,
    "promotions": false
  }'::JSONB,
  
  -- Shopping preferences
  language VARCHAR(10) DEFAULT 'en', -- ISO 639-1
  currency VARCHAR(3) DEFAULT 'USD', -- ISO 4217
  save_payment_method BOOLEAN DEFAULT TRUE,
  
  -- Privacy
  accepts_marketing BOOLEAN DEFAULT FALSE,
  accepts_marketing_at TIMESTAMP,
  
  -- Metadata
  custom_settings JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_preferences_customer_id ON customer_preferences(customer_id);
```

---

### 1.4 sessions

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Token info
  token VARCHAR(512) NOT NULL UNIQUE, -- JWT or session ID
  token_type VARCHAR(20) NOT NULL DEFAULT 'bearer',
  
  -- Device info
  ip_address INET NOT NULL,
  user_agent TEXT,
  device_type VARCHAR(20), -- ENUM: web, mobile, desktop
  device_name VARCHAR(255),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  
  CONSTRAINT valid_session CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_customer_id ON sessions(customer_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_active ON sessions(is_active, expires_at)
  WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

## 🛍️ CATALOG DOMAIN SCHEMA

### 2.1 products

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  
  -- Organization
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- ENUM: draft, active, archived
  category_id UUID, -- Will add categories table later
  
  -- SKU & identification
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  
  -- Pricing
  base_price DECIMAL(15, 2) NOT NULL,
  compare_at_price DECIMAL(15, 2),
  cost DECIMAL(15, 2), -- internal cost
  
  -- Attributes
  vendor VARCHAR(255),
  product_type VARCHAR(255),
  requires_shipping BOOLEAN DEFAULT TRUE,
  is_gift BOOLEAN DEFAULT FALSE,
  is_digital BOOLEAN DEFAULT FALSE,
  is_physical BOOLEAN DEFAULT TRUE,
  
  -- Variants
  has_variants BOOLEAN DEFAULT FALSE,
  
  -- SEO
  seo_title VARCHAR(60),
  seo_description VARCHAR(160),
  seo_keywords TEXT[], -- array of keywords
  slug VARCHAR(255) NOT NULL UNIQUE,
  
  -- Metadata
  custom_fields JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP,
  
  CONSTRAINT valid_price CHECK (base_price >= 0),
  CONSTRAINT valid_cost CHECK (cost IS NULL OR cost >= 0)
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_vendor ON products(vendor);
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

---

### 2.2 product_variants

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant info
  title VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  
  -- Pricing
  price DECIMAL(15, 2) NOT NULL,
  compare_at_price DECIMAL(15, 2),
  cost DECIMAL(15, 2),
  
  -- Inventory
  inventory_quantity INTEGER NOT NULL DEFAULT 0,
  inventory_tracked BOOLEAN DEFAULT TRUE,
  
  -- Physical attributes
  weight DECIMAL(10, 3),
  weight_unit VARCHAR(10) DEFAULT 'lb', -- ENUM: lb, kg
  
  -- Image
  image_id UUID,
  
  -- Status
  available BOOLEAN DEFAULT TRUE,
  
  -- Variant options (e.g., {size: 'M', color: 'Red'})
  options JSONB DEFAULT '{}'::JSONB,
  
  -- Position
  position INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT unique_variant_per_product CHECK (
    product_id IS NOT NULL
  )
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX idx_product_variants_available ON product_variants(product_id, available);
```

---

### 2.3 product_images

```sql
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Image
  url VARCHAR(512) NOT NULL,
  alt_text VARCHAR(255),
  
  -- Dimensions
  width INTEGER,
  height INTEGER,
  
  -- Ordering
  position INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_variant_id ON product_images(variant_id);
```

---

### 2.4 collections

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_id UUID,
  
  -- Organization
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- ENUM: draft, active, archived
  position INTEGER DEFAULT 0,
  slug VARCHAR(255) NOT NULL UNIQUE,
  
  -- Type
  type VARCHAR(20) NOT NULL DEFAULT 'manual',
    -- ENUM: manual, automated, smart
  
  -- Automated collection rules (JSON format)
  -- Example: [{field: 'tag', operator: 'equals', value: 'new'}]
  rules JSONB,
  rules_logic VARCHAR(10) DEFAULT 'all', -- ENUM: all, any
  
  -- Smart collection rules (behavioral)
  smart_rules JSONB, -- Example: [{type: 'bestselling', limit: 10}]
  
  -- Display settings
  display_settings JSONB DEFAULT '{
    "layout": "grid",
    "items_per_page": 12,
    "sort_by": "position"
  }'::JSONB,
  
  -- SEO
  seo_title VARCHAR(60),
  seo_description VARCHAR(160),
  seo_keywords TEXT[],
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_type CHECK (type IN ('manual', 'automated', 'smart'))
);

CREATE INDEX idx_collections_status ON collections(status);
CREATE INDEX idx_collections_slug ON collections(slug);
CREATE INDEX idx_collections_position ON collections(position);
```

---

### 2.5 collection_products

```sql
CREATE TABLE collection_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Position for manual ordering
  position INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_collection_product UNIQUE(collection_id, product_id)
);

CREATE INDEX idx_collection_products_collection_id ON collection_products(collection_id);
CREATE INDEX idx_collection_products_product_id ON collection_products(product_id);
CREATE INDEX idx_collection_products_position ON collection_products(collection_id, position);
```

---

## 🛒 SHOPPING DOMAIN SCHEMA

### 3.1 carts

```sql
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Cart state
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- ENUM: active, abandoned, converted
  
  -- Applied promotions
  applied_promotion_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Metadata
  gift_message TEXT,
  notes TEXT,
  
  -- Recovery
  recovery_email_sent_at TIMESTAMP,
  recovery_email_count INTEGER DEFAULT 0,
  
  -- Converted order
  converted_to_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  
  CONSTRAINT valid_cart CHECK (
    (customer_id IS NOT NULL OR session_id IS NOT NULL) AND
    expires_at > created_at
  )
);

CREATE INDEX idx_carts_customer_id ON carts(customer_id);
CREATE INDEX idx_carts_session_id ON carts(session_id);
CREATE INDEX idx_carts_status ON carts(status);
CREATE INDEX idx_carts_active ON carts(updated_at DESC) WHERE status = 'active';
CREATE INDEX idx_carts_expires_at ON carts(expires_at);
```

---

### 3.2 cart_items

```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  
  -- Product reference
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  
  -- Item details
  title VARCHAR(255) NOT NULL,
  price DECIMAL(15, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Image reference
  image_id UUID,
  
  -- Customizations
  customizations JSONB,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_price CHECK (price >= 0)
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
```

---

## 💳 PAYMENT DOMAIN SCHEMA

### 4.1 payment_intents

```sql
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order reference
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Amount
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- ISO 4217
  
  -- Provider info
  provider VARCHAR(50) NOT NULL, -- ENUM: stripe, razorpay, adyen
  provider_intent_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Customer
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  
  -- Payment method
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ENUM: pending, authorized, captured, failed, refunded
  
  -- Address
  billing_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  
  -- Risk assessment
  risk_level VARCHAR(20), -- ENUM: low, medium, high
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  ip_address INET NOT NULL,
  user_agent TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  captured_at TIMESTAMP,
  
  CONSTRAINT valid_amount CHECK (amount > 0)
);

CREATE INDEX idx_payment_intents_order_id ON payment_intents(order_id);
CREATE INDEX idx_payment_intents_customer_id ON payment_intents(customer_id);
CREATE INDEX idx_payment_intents_provider ON payment_intents(provider, provider_intent_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_created_at ON payment_intents(created_at DESC);
```

---

### 4.2 payment_methods

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Type
  type VARCHAR(20) NOT NULL,
    -- ENUM: card, paypal, bank_transfer, apple_pay, google_pay
  
  -- Card info
  card_brand VARCHAR(50), -- visa, mastercard, amex, discover
  card_last_4 VARCHAR(4),
  card_expiry_month INTEGER,
  card_expiry_year INTEGER,
  card_fingerprint VARCHAR(255),
  
  -- Wallet
  wallet_provider VARCHAR(50), -- apple_pay, google_pay
  
  -- Provider token
  provider_token_id VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL,
  
  -- Metadata
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  nickname VARCHAR(100),
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE INDEX idx_payment_methods_customer_id ON payment_methods(customer_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(customer_id, is_default)
  WHERE is_default = TRUE;
CREATE INDEX idx_payment_methods_provider ON payment_methods(provider, provider_token_id);
```

---

### 4.3 payment_refunds

```sql
CREATE TABLE payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  
  -- Amount
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  
  -- Reason
  reason VARCHAR(50) NOT NULL,
    -- ENUM: customer_request, fraud, accidental_charge, other
  notes TEXT,
  
  -- Provider info
  provider_refund_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ENUM: pending, completed, failed
  
  -- Audit
  requested_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  
  CONSTRAINT valid_refund_amount CHECK (amount > 0)
);

CREATE INDEX idx_payment_refunds_payment_intent_id ON payment_refunds(payment_intent_id);
CREATE INDEX idx_payment_refunds_status ON payment_refunds(status);
CREATE INDEX idx_payment_refunds_created_at ON payment_refunds(created_at DESC);
```

---

## 📦 ORDERS DOMAIN SCHEMA

### 5.1 orders

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  order_number VARCHAR(50) NOT NULL UNIQUE, -- e.g., #1001
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  
  -- Totals
  subtotal DECIMAL(15, 2) NOT NULL,
  tax DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  shipping DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ENUM: pending, confirmed, processing, shipped, delivered, cancelled
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ENUM: pending, paid, refunded, partially_refunded
  fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'unfulfilled',
    -- ENUM: unfulfilled, partial, fulfilled
  
  -- Addresses
  shipping_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  billing_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  
  -- Shipping & payment
  shipping_method_id UUID REFERENCES shipping_methods(id) ON DELETE SET NULL,
  payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  
  -- Shipping tracking
  tracking_number VARCHAR(100),
  tracking_url VARCHAR(512),
  carrier VARCHAR(100),
  
  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  CONSTRAINT valid_totals CHECK (total = subtotal + tax + shipping - discount),
  CONSTRAINT valid_timestamps CHECK (
    (cancelled_at IS NULL OR cancelled_at > created_at) AND
    (shipped_at IS NULL OR shipped_at > created_at) AND
    (delivered_at IS NULL OR delivered_at > shipped_at)
  )
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_customer_created ON orders(customer_id, created_at DESC);
```

---

### 5.2 order_line_items

```sql
CREATE TABLE order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Product reference
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  
  -- Item details
  title VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  price DECIMAL(15, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  
  -- Calculations
  discount_amount DECIMAL(15, 2) DEFAULT 0.00,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  subtotal DECIMAL(15, 2) GENERATED ALWAYS AS (price * quantity) STORED,
  total DECIMAL(15, 2) GENERATED ALWAYS AS (
    (price * quantity) + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
  ) STORED,
  
  -- Fulfillment
  fulfilled_quantity INTEGER DEFAULT 0,
  
  -- Image reference
  image_id UUID,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT fulfilled_not_over CHECK (fulfilled_quantity <= quantity)
);

CREATE INDEX idx_order_line_items_order_id ON order_line_items(order_id);
CREATE INDEX idx_order_line_items_variant_id ON order_line_items(variant_id);
CREATE INDEX idx_order_line_items_product_id ON order_line_items(product_id);
```

---

### 5.3 order_timeline

```sql
CREATE TABLE order_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Event
  event VARCHAR(50) NOT NULL,
    -- ENUM: order_created, payment_received, processing_started, 
    --       shipped, delivered, returned, cancelled, refunded
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Actor
  actor_type VARCHAR(20), -- ENUM: system, staff, customer
  actor_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  
  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_timeline_order_id ON order_timeline(order_id);
CREATE INDEX idx_order_timeline_event ON order_timeline(event);
CREATE INDEX idx_order_timeline_created_at ON order_timeline(order_id, created_at DESC);
```

---

## 📦 FULFILLMENT DOMAIN SCHEMA

### 6.1 fulfillments

```sql
CREATE TABLE fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Location
  location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
  
  -- Shipping info
  tracking_number VARCHAR(100) NOT NULL,
  carrier VARCHAR(100) NOT NULL,
  tracking_url VARCHAR(512),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ENUM: pending, processing, shipped, delivered, returned
  
  -- Estimated delivery
  estimated_delivery_at TIMESTAMP,
  
  -- Dates
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  -- Notification
  customer_notified_at TIMESTAMP,
  
  CONSTRAINT valid_dates CHECK (
    shipped_at IS NULL OR shipped_at > created_at
  )
);

CREATE INDEX idx_fulfillments_order_id ON fulfillments(order_id);
CREATE INDEX idx_fulfillments_tracking_number ON fulfillments(tracking_number);
CREATE INDEX idx_fulfillments_status ON fulfillments(status);
```

---

### 6.2 fulfillment_line_items

```sql
CREATE TABLE fulfillment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  order_line_item_id UUID NOT NULL REFERENCES order_line_items(id) ON DELETE RESTRICT,
  
  quantity INTEGER NOT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_fulfillment_line_items_fulfillment_id ON fulfillment_line_items(fulfillment_id);
CREATE INDEX idx_fulfillment_line_items_order_line_item_id ON fulfillment_line_items(order_line_item_id);
```

---

### 6.3 shipping_labels

```sql
CREATE TABLE shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  
  -- Carrier & tracking
  carrier VARCHAR(100) NOT NULL,
  tracking_number VARCHAR(100) NOT NULL,
  
  -- Label
  label_url VARCHAR(512),
  label_data BYTEA, -- PDF content
  label_format VARCHAR(20) DEFAULT 'pdf',
  
  -- Cost
  cost DECIMAL(15, 2) NOT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_cost CHECK (cost >= 0)
);

CREATE INDEX idx_shipping_labels_fulfillment_id ON shipping_labels(fulfillment_id);
CREATE INDEX idx_shipping_labels_carrier ON shipping_labels(carrier, tracking_number);
```

---

### 6.4 returns

```sql
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order reference
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Return info
  reason VARCHAR(50) NOT NULL,
    -- ENUM: wrong_item, damaged, changed_mind, defective, other
  reason_details TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ENUM: pending, approved, rejected, shipped_back, received, refunded
  
  -- Shipping
  return_tracking_number VARCHAR(100),
  returned_at TIMESTAMP,
  received_at TIMESTAMP,
  
  -- Refund
  refund_intent_id UUID REFERENCES payment_refunds(id) ON DELETE SET NULL,
  refund_amount DECIMAL(15, 2),
  restocking_percentage DECIMAL(5, 2),
  
  -- Rejection
  rejection_reason TEXT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP
);

CREATE INDEX idx_returns_order_id ON returns(order_id);
CREATE INDEX idx_returns_customer_id ON returns(customer_id);
CREATE INDEX idx_returns_status ON returns(status);
CREATE INDEX idx_returns_created_at ON returns(created_at DESC);
```

---

### 6.5 return_items

```sql
CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_line_item_id UUID NOT NULL REFERENCES order_line_items(id) ON DELETE RESTRICT,
  
  -- Item details
  quantity INTEGER NOT NULL,
  refund_amount DECIMAL(15, 2) NOT NULL,
  condition VARCHAR(20) DEFAULT 'new',
    -- ENUM: new, opened, damaged
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_return_items_return_id ON return_items(return_id);
CREATE INDEX idx_return_items_order_line_item_id ON return_items(order_line_item_id);
```

---

## 🚚 INVENTORY DOMAIN SCHEMA

### 7.1 inventory_locations

```sql
CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location info
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'warehouse',
    -- ENUM: warehouse, store, fulfillment
  
  -- Address
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country_code VARCHAR(2),
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_locations_active ON inventory_locations(is_active);
CREATE INDEX idx_inventory_locations_default ON inventory_locations(is_default);
```

---

### 7.2 inventory_levels

```sql
CREATE TABLE inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  
  -- Quantities
  available INTEGER NOT NULL DEFAULT 0, -- tracked - committed
  tracked INTEGER NOT NULL DEFAULT 0, -- total stock
  committed INTEGER NOT NULL DEFAULT 0, -- reserved for orders
  
  -- Last count
  last_counted_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_inventory CHECK (
    available >= 0 AND 
    tracked >= 0 AND 
    committed >= 0 AND
    available = tracked - committed
  ),
  CONSTRAINT unique_variant_location UNIQUE(variant_id, location_id)
);

CREATE INDEX idx_inventory_levels_variant_id ON inventory_levels(variant_id);
CREATE INDEX idx_inventory_levels_location_id ON inventory_levels(location_id);
CREATE INDEX idx_inventory_levels_available ON inventory_levels(variant_id, location_id)
  WHERE available > 0;
```

---

### 7.3 inventory_adjustments

```sql
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  
  -- Adjustment
  quantity INTEGER NOT NULL, -- positive or negative
  reason VARCHAR(50) NOT NULL,
    -- ENUM: sale, adjustment, return, transfer, damage, other
  
  note TEXT,
  
  -- Related record
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  return_id UUID REFERENCES returns(id) ON DELETE SET NULL,
  
  -- Audit
  recorded_by UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_adjustments_variant_id ON inventory_adjustments(variant_id);
CREATE INDEX idx_inventory_adjustments_location_id ON inventory_adjustments(location_id);
CREATE INDEX idx_inventory_adjustments_reason ON inventory_adjustments(reason);
CREATE INDEX idx_inventory_adjustments_created_at ON inventory_adjustments(created_at DESC);
```

---

### 7.4 inventory_reservations

```sql
CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  
  quantity INTEGER NOT NULL,
  reason VARCHAR(50) NOT NULL,
    -- ENUM: order, hold, pre_order
  
  -- Related record
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Expiry
  expires_at TIMESTAMP,
  
  -- Status
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP,
  
  CONSTRAINT valid_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_inventory_reservations_variant_id ON inventory_reservations(variant_id);
CREATE INDEX idx_inventory_reservations_order_id ON inventory_reservations(order_id);
CREATE INDEX idx_inventory_reservations_active ON inventory_reservations(expires_at DESC)
  WHERE released_at IS NULL;
```

---

## 💰 PRICING & PROMOTIONS SCHEMA

### 8.1 prices

```sql
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Prices
  base_price DECIMAL(15, 2) NOT NULL,
  compare_at_price DECIMAL(15, 2),
  cost DECIMAL(15, 2),
  
  -- Calculations (denormalized for performance)
  margin_percentage DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN cost > 0 THEN ((base_price - cost) / base_price) * 100
      ELSE NULL
    END
  ) STORED,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_variant_price UNIQUE(variant_id),
  CONSTRAINT valid_prices CHECK (
    base_price >= 0 AND 
    (cost IS NULL OR cost >= 0)
  )
);

CREATE INDEX idx_prices_variant_id ON prices(variant_id);
```

---

### 8.2 pricing_rules

```sql
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_id UUID NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  
  -- Conditions (JSON format allows flexibility)
  conditions JSONB NOT NULL,
  -- Example: {
  --   "type": "tier",
  --   "min_quantity": 3,
  --   "max_quantity": 10
  -- }
  -- Or: {
  --   "type": "time",
  --   "starts_at": "2026-09-14",
  --   "ends_at": "2026-09-21"
  -- }
  
  -- Price adjustment
  adjustment_type VARCHAR(20) NOT NULL, -- ENUM: percentage, fixed
  adjustment_value DECIMAL(15, 2) NOT NULL,
  
  -- Priority (lower number = higher priority)
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_rules_price_id ON pricing_rules(price_id);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(price_id, is_active, priority)
  WHERE is_active = TRUE;
```

---

### 8.3 promotions

```sql
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic
  title VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(100),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- ENUM: draft, scheduled, active, paused, ended
  
  -- Dates
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  
  -- Promotion type
  type VARCHAR(50) NOT NULL,
    -- ENUM: percentage, fixed_amount, free_shipping, bogo, tiered
  
  value DECIMAL(15, 2), -- for percentage, fixed, bogo
  
  -- Tiered (for tiered promotions)
  tiers JSONB, -- [{quantity: 3, discount: 10}, {quantity: 5, discount: 15}]
  
  -- BOGO details
  bogo_details JSONB, -- {buy_quantity: 1, get_quantity: 1, get_percentage: 50}
  
  -- Eligibility rules
  eligibility JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Example: {
  --   "min_purchase": 50,
  --   "customer_groups": ["vip"],
  --   "applicable_products": ["prod-1", "prod-2"]
  -- }
  
  -- Code-specific settings
  code_settings JSONB, -- {usage_limit: 100, usage_limit_per_customer: 1}
  
  -- Automatic or code-based
  automatic BOOLEAN DEFAULT FALSE,
  
  -- Combinability
  combinable_with VARCHAR(20) DEFAULT 'all',
    -- ENUM: all, none, specified
  compatible_promotion_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Metrics
  total_used INTEGER DEFAULT 0,
  total_revenue_loss DECIMAL(15, 2) DEFAULT 0.00,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_dates CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT valid_value CHECK (
    type NOT IN ('percentage', 'fixed_amount', 'bogo') OR value > 0
  )
);

CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
CREATE INDEX idx_promotions_active ON promotions(starts_at, ends_at)
  WHERE status = 'active';
CREATE INDEX idx_promotions_created_at ON promotions(created_at DESC);
```

---

### 8.4 promotion_codes

```sql
CREATE TABLE promotion_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  
  code VARCHAR(100) NOT NULL UNIQUE,
  
  -- Usage
  usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER,
  usage_limit_per_customer INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_code CHECK (LENGTH(code) > 0)
);

CREATE INDEX idx_promotion_codes_promotion_id ON promotion_codes(promotion_id);
CREATE INDEX idx_promotion_codes_code ON promotion_codes(code);
CREATE INDEX idx_promotion_codes_active ON promotion_codes(code)
  WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW());
```

---

## 🚚 SHIPPING SCHEMA

### 9.1 shipping_methods

```sql
CREATE TABLE shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Carrier
  carrier VARCHAR(100) NOT NULL,
    -- ENUM: usps, fedex, ups, dhl, other
  service_type VARCHAR(100) NOT NULL,
  
  -- Cost
  base_cost DECIMAL(15, 2) NOT NULL,
  
  -- Regional
  countries TEXT[] DEFAULT ARRAY[]::TEXT[],
  regions TEXT[],
  
  -- Conditions
  min_order_amount DECIMAL(15, 2),
  max_weight DECIMAL(10, 3),
  
  -- Timing
  estimated_days INTEGER,
  
  -- Rules
  rules JSONB, -- Shipping rules JSON
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_cost CHECK (base_cost >= 0)
);

CREATE INDEX idx_shipping_methods_active ON shipping_methods(is_active);
CREATE INDEX idx_shipping_methods_carrier ON shipping_methods(carrier);
```

---

### 9.2 shipping_rates

```sql
CREATE TABLE shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_method_id UUID NOT NULL REFERENCES shipping_methods(id) ON DELETE CASCADE,
  
  -- Dynamic rate from carrier
  cost DECIMAL(15, 2) NOT NULL,
  estimated_days INTEGER,
  
  -- Valid for certain period
  quoted_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_rate CHECK (cost >= 0),
  CONSTRAINT valid_expiry CHECK (expires_at > quoted_at)
);

CREATE INDEX idx_shipping_rates_method_id ON shipping_rates(shipping_method_id);
CREATE INDEX idx_shipping_rates_expires_at ON shipping_rates(expires_at DESC);
```

---

## 📊 MARKETING & ENGAGEMENT SCHEMA

### 10.1 email_templates

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
    -- ENUM: transactional, marketing, promotional
  
  -- Content
  subject VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT NOT NULL,
  
  -- Metadata
  from_name VARCHAR(255),
  from_email VARCHAR(255),
  reply_to VARCHAR(255),
  preheader VARCHAR(255),
  
  -- Variables this template uses
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_templates_category ON email_templates(category);
```

---

### 10.2 email_campaigns

```sql
CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic
  name VARCHAR(255) NOT NULL,
  
  -- Template
  email_template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE RESTRICT,
  template_variables JSONB DEFAULT '{}'::JSONB,
  
  -- Audience
  audience_type VARCHAR(50) NOT NULL, -- ENUM: all, segment, specific
  segment_id UUID REFERENCES customer_segments(id) ON DELETE SET NULL,
  
  -- Send configuration
  send_type VARCHAR(50) NOT NULL, -- ENUM: immediate, scheduled, trigger
  scheduled_at TIMESTAMP,
  trigger_event VARCHAR(100),
  
  -- Personalization
  include_personalization BOOLEAN DEFAULT FALSE,
  
  -- A/B testing
  ab_test_enabled BOOLEAN DEFAULT FALSE,
  ab_test_split_percentage INTEGER,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- ENUM: draft, scheduled, sending, sent, paused
  
  -- Metrics
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP
);

CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_template_id ON email_campaigns(email_template_id);
CREATE INDEX idx_email_campaigns_segment_id ON email_campaigns(segment_id);
CREATE INDEX idx_email_campaigns_created_at ON email_campaigns(created_at DESC);
```

---

### 10.3 customer_segments

```sql
CREATE TABLE customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  
  -- Rules
  rules JSONB NOT NULL,
  -- Example: [{field: 'total_spent', operator: 'gt', value: 100}]
  rules_logic VARCHAR(10) DEFAULT 'all', -- ENUM: all, any
  
  -- Dynamic recalculation
  dynamic BOOLEAN DEFAULT FALSE,
  
  -- Membership count (cached)
  member_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_calculated_at TIMESTAMP
);

CREATE INDEX idx_customer_segments_dynamic ON customer_segments(dynamic);
```

---

### 10.4 customer_segment_memberships

```sql
CREATE TABLE customer_segment_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_membership UNIQUE(customer_id, segment_id)
);

CREATE INDEX idx_segment_memberships_customer_id ON customer_segment_memberships(customer_id);
CREATE INDEX idx_segment_memberships_segment_id ON customer_segment_memberships(segment_id);
```

---

## 🎯 LOYALTY SCHEMA

### 11.1 loyalty_programs

```sql
CREATE TABLE loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Points
  points_per_dollar DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Tiers
  tiers JSONB NOT NULL, -- Array of tier definitions
  
  -- Rules
  earning_rules JSONB DEFAULT '[]'::JSONB,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 11.2 customer_loyalty_profiles

```sql
CREATE TABLE customer_loyalty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  loyalty_program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  
  -- Current state
  current_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  current_tier_id UUID, -- references loyalty_tiers
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loyalty_profiles_customer_id ON customer_loyalty_profiles(customer_id);
CREATE INDEX idx_loyalty_profiles_program_id ON customer_loyalty_profiles(loyalty_program_id);
```

---

### 11.3 points_transactions

```sql
CREATE TABLE points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_profile_id UUID NOT NULL REFERENCES customer_loyalty_profiles(id) ON DELETE CASCADE,
  
  -- Transaction
  points INTEGER NOT NULL, -- positive or negative
  reason VARCHAR(100) NOT NULL,
    -- ENUM: earned, redeemed, adjusted, expired
  
  type VARCHAR(20) NOT NULL, -- ENUM: earned, redeemed, adjusted, expired
  
  -- Related record
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_id UUID, -- references loyalty_rewards
  
  -- Expiry
  expires_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_points_transactions_profile_id ON points_transactions(loyalty_profile_id);
CREATE INDEX idx_points_transactions_created_at ON points_transactions(created_at DESC);
```

---

## ⭐ REVIEWS SCHEMA

### 12.1 product_reviews

```sql
CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Reviewer
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reviewer_name VARCHAR(255) NOT NULL,
  reviewer_email VARCHAR(255) NOT NULL,
  
  -- Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  rating INTEGER NOT NULL,
    -- CONSTRAINT: 1-5
  
  -- Images
  image_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- ENUM: pending, approved, rejected
  
  -- Authenticity
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  purchase_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Engagement
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  
  -- Moderation
  is_flagged BOOLEAN DEFAULT FALSE,
  flagged_count INTEGER DEFAULT 0,
  moderator_notes TEXT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  
  CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5)
);

CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_customer_id ON product_reviews(customer_id);
CREATE INDEX idx_product_reviews_status ON product_reviews(status);
CREATE INDEX idx_product_reviews_rating ON product_reviews(product_id, rating);
CREATE INDEX idx_product_reviews_verified ON product_reviews(is_verified_purchase);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at DESC);
```

---

### 12.2 review_responses

```sql
CREATE TABLE review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  
  -- Respondent
  respondent_type VARCHAR(20) NOT NULL, -- ENUM: staff, owner
  respondent_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  respondent_name VARCHAR(255),
  
  -- Content
  body TEXT NOT NULL,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_responses_review_id ON review_responses(product_review_id);
```

---

## 📊 ANALYTICS SCHEMA

### 13.1 analytics_events

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event
  event_type VARCHAR(100) NOT NULL,
    -- ENUM: view_product, add_to_cart, remove_from_cart, 
    --       start_checkout, complete_purchase, view_collection, search
  
  -- Customer
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  
  -- Related data
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Event data
  properties JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_customer_id ON analytics_events(customer_id);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_product_id ON analytics_events(product_id)
  WHERE product_id IS NOT NULL;

-- Partitioning for large event volume
-- CREATE TABLE analytics_events_2026_01 PARTITION OF analytics_events
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

### 13.2 analytics_sessions

```sql
CREATE TABLE analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Duration
  duration_seconds INTEGER,
  
  -- Activity
  page_views INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  
  -- Conversion
  converted BOOLEAN DEFAULT FALSE,
  order_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Device & location
  country VARCHAR(2),
  city VARCHAR(100),
  device_type VARCHAR(20),
  browser VARCHAR(100),
  os VARCHAR(100),
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE INDEX idx_analytics_sessions_session_id ON analytics_sessions(session_id);
CREATE INDEX idx_analytics_sessions_customer_id ON analytics_sessions(customer_id);
CREATE INDEX idx_analytics_sessions_created_at ON analytics_sessions(created_at DESC);
```

---

## 👥 ADMIN SCHEMA

### 14.1 staff_members

```sql
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Personal
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Security
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  
  -- Activity
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_members_email ON staff_members(email);
CREATE INDEX idx_staff_members_active ON staff_members(is_active);
```

---

### 14.2 roles

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  
  -- Type
  is_system_role BOOLEAN DEFAULT FALSE, -- cannot be deleted
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 14.3 permissions

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Resource and action
  resource VARCHAR(50) NOT NULL,
    -- ENUM: products, orders, customers, settings, reports, staff
  action VARCHAR(50) NOT NULL,
    -- ENUM: create, read, update, delete, export
  
  description TEXT,
  
  CONSTRAINT unique_permission UNIQUE(resource, action)
);
```

---

### 14.4 role_permissions

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  
  CONSTRAINT unique_role_permission UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
```

---

### 14.5 staff_roles

```sql
CREATE TABLE staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  
  CONSTRAINT unique_staff_role UNIQUE(staff_member_id, role_id)
);

CREATE INDEX idx_staff_roles_staff_member_id ON staff_roles(staff_member_id);
CREATE INDEX idx_staff_roles_role_id ON staff_roles(role_id);
```

---

### 14.6 activity_logs

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  staff_member_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  
  -- Action
  resource_type VARCHAR(100) NOT NULL,
    -- ENUM: product, order, customer, staff_member, settings, etc
  resource_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
    -- ENUM: created, updated, deleted, approved, rejected, etc
  
  -- Changes
  changes JSONB,
  -- Example: {
  --   "title": {"old": "Old Title", "new": "New Title"},
  --   "price": {"old": 100, "new": 120}
  -- }
  
  -- Audit
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_staff_member_id ON activity_logs(staff_member_id);
CREATE INDEX idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
```

---

## 🔗 FOREIGN KEY RELATIONSHIPS

```
┌─ customers
├─ customer_addresses (many-to-one)
├─ customer_preferences (one-to-one)
├─ sessions (many-to-one)
├─ orders (many-to-one)
├─ product_reviews (many-to-one)
├─ customer_loyalty_profiles (many-to-one)
└─ activity_logs (many-to-one)

┌─ products
├─ product_variants (one-to-many)
├─ product_images (one-to-many)
├─ collections via collection_products (many-to-many)
├─ prices (one-to-one via variant)
├─ inventory_levels (one-to-many via variant)
├─ orders via order_line_items (many-to-many)
└─ product_reviews (one-to-many)

┌─ orders
├─ order_line_items (one-to-many)
├─ order_timeline (one-to-many)
├─ fulfillments (one-to-many)
├─ returns (one-to-many)
├─ payment_intents (one-to-many)
└─ analytics_events (one-to-many)

┌─ payment_intents
├─ payment_methods (many-to-one)
├─ payment_refunds (one-to-many)
└─ payment_webhooks (one-to-many)

┌─ fulfillments
├─ fulfillment_line_items (one-to-many)
├─ shipping_labels (one-to-many)
└─ order_line_items via fulfillment_line_items (many-to-many)

┌─ returns
└─ return_items (one-to-many)

┌─ email_campaigns
├─ email_templates (many-to-one)
├─ customer_segments (many-to-one)
└─ email_logs (one-to-many)

┌─ customer_segments
└─ customer_segment_memberships (one-to-many)
    └─ customers (many-to-many)
```

---

## 📈 PERFORMANCE OPTIMIZATION

### Indexes Strategy

**High-Traffic Indexes:**
- `customers(email_normalized)` - login
- `carts(customer_id)` - cart retrieval
- `orders(customer_id, created_at)` - order history
- `product_variants(product_id)` - product loading
- `analytics_events(created_at)` - event ingestion
- `order_line_items(order_id)` - order details

**Composite Indexes:**
- `inventory_levels(variant_id, location_id)` - stock check
- `customer_segment_memberships(customer_id, segment_id)` - segment loading
- `role_permissions(role_id, permission_id)` - permission checks

**Partial Indexes:**
- Active sessions only
- Active promotions only
- Non-deleted customers
- Published products

### Denormalization Strategy

**Pre-calculated fields:**
- `orders.total` (subtotal + tax + shipping - discount)
- `prices.margin_percentage` (for reporting)
- `customers.total_spent` (for analytics)
- `customer_loyalty_profiles.current_points` (for display)

**Cached aggregations:**
- `customer_segments.member_count`
- `analytics_sessions.events_count`
- `email_campaigns.sent_count`

---

## 🔄 MATERIALIZED VIEWS (Optional)

```sql
-- Daily sales summary
CREATE MATERIALIZED VIEW daily_sales AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as order_count,
  SUM(total) as revenue,
  AVG(total) as avg_order_value
FROM orders
WHERE status != 'cancelled'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Product performance
CREATE MATERIALIZED VIEW product_performance AS
SELECT 
  p.id,
  p.title,
  COUNT(DISTINCT oli.order_id) as units_sold,
  SUM(oli.quantity) as total_quantity,
  SUM(oli.quantity * oli.price) as revenue,
  AVG(pr.rating) as avg_rating,
  COUNT(DISTINCT pr.id) as review_count
FROM products p
LEFT JOIN order_line_items oli ON p.id = oli.product_id
LEFT JOIN product_reviews pr ON p.id = pr.product_id
GROUP BY p.id, p.title
ORDER BY revenue DESC;
```

---

## 🚀 NEXT STEPS

1. **Create migration files** for PostgreSQL
2. **Add indexes** for performance
3. **Set up views** for reporting
4. **Create test data** for development
5. **Document relationships** for ORM

---

**Database Design**: ✅ Complete  
**Status**: Ready for ORM integration (TypeORM)  
**Next**: Create migration scripts
