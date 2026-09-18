# Phase 4: Catalog Domain — PLANNING

**Status:** 📋 PLANNING & READY TO IMPLEMENT

**Date:** 2026-09-14

**Next Phase:** Catalog Domain (Products, Categories, Inventory)

---

## Phase 4 Overview

Build the Catalog Domain following the same proven patterns from Core Domain:
- **Same architecture:** Entities → Repositories → Services → Controllers → Routes
- **Same security:** Store isolation, soft delete, audit logging
- **Same testing:** Integration tests for all features
- **Same quality:** Full type safety, error handling, documentation

---

## Phase 4 Scope

### 4A: Catalog Domain Entities (5 tables)

#### 1. **Products Table**
```sql
id, store_id (composite PK)
name, slug, description, sku
status (active/draft/archived)
created_by, created_at, updated_at, deleted_at
```

#### 2. **Categories Table**
```sql
id, store_id (composite FK)
name, slug, description
parent_category_id (hierarchical)
display_order, is_active
created_at, updated_at, deleted_at
```

#### 3. **Product Variants Table**
```sql
id, product_id, store_id (composite FKs)
sku, name
price, cost, weight
status
created_at, updated_at, deleted_at
```

#### 4. **Inventory Table**
```sql
id, variant_id, store_id (composite FK)
quantity_available, quantity_reserved
reorder_level, reorder_quantity
last_counted_at
created_at, updated_at
```

#### 5. **Product Images Table**
```sql
id, product_id, store_id (composite FK)
url, alt_text
display_order, is_primary
created_at, deleted_at
```

### 4B: Catalog Services & Repositories

**Repositories (5 classes)**
- ProductRepository (find, create, list, soft delete)
- CategoryRepository (find, tree, create, soft delete)
- VariantRepository (find, create, update)
- InventoryRepository (check stock, reserve, release)
- ProductImageRepository (create, delete, reorder)

**Services (3 classes)**
- ProductService (business logic)
- CategoryService (hierarchical operations)
- InventoryService (stock management)

### 4C: Catalog API Routes (18 endpoints)

**Products (6)**
- GET /products (list, filter, search)
- POST /products (create)
- GET /products/:id (detail)
- PATCH /products/:id (update)
- DELETE /products/:id (soft delete)
- POST /products/:id/restore (restore)

**Categories (6)**
- GET /categories (tree view)
- POST /categories (create)
- GET /categories/:id (detail)
- PATCH /categories/:id (update)
- DELETE /categories/:id (soft delete)
- POST /categories/:id/restore (restore)

**Variants (3)**
- POST /products/:id/variants (create)
- PATCH /variants/:id (update)
- DELETE /variants/:id (delete)

**Inventory (3)**
- GET /inventory/:variantId (check stock)
- POST /inventory/:variantId/reserve (reserve stock)
- POST /inventory/:variantId/release (release reservation)

---

## Implementation Roadmap

### Step 1: Database Design & Migrations
- Design all 5 catalog tables
- Create composite FKs and indexes
- Write TypeORM migrations
- Add soft delete support

### Step 2: Entities & Repositories
- Create 5 entity classes with relationships
- Create 5 repository classes with BaseRepository inheritance
- Implement store isolation filtering
- Add soft delete/restore methods

### Step 3: Services & Business Logic
- ProductService (search, filtering, publishing)
- CategoryService (hierarchy, reordering)
- InventoryService (stock tracking, reservations)

### Step 4: API Controllers & Routes
- 5 controllers (Products, Categories, Variants, Inventory, Images)
- 18 routes across catalog operations
- DTOs for requests/responses
- Error handling

### Step 5: Integration Tests
- Product CRUD tests
- Category hierarchy tests
- Inventory management tests
- Store isolation tests
- Soft delete tests
- Search & filtering tests

---

## Catalog-Specific Features

### Product Publishing Workflow
```
DRAFT → SCHEDULED → PUBLISHED → ARCHIVED → DELETED (soft)
```

### Inventory Management
- Track available vs reserved quantities
- Automatic reservation on order
- Reorder level alerts
- Low stock warnings

### Category Hierarchy
- Parent-child relationships
- Breadcrumb support
- Category tree views
- Reorderable categories

### Product Variants
- SKU-specific pricing
- Size/color/style variants
- Variant-level inventory
- Variant selection UI support

### Search & Filtering
- Full-text search on product name/description
- Filter by category, price, status
- Faceted search support
- Sort by relevance, price, newest

---

## Implementation Estimate

| Component | Time |
|-----------|------|
| Entities & Migrations | 2-3 hours |
| Repositories & Services | 2-3 hours |
| Controllers & Routes | 2-3 hours |
| Integration Tests | 3-4 hours |
| Documentation | 1-2 hours |
| **Total** | **10-15 hours** |

---

## Files to Create

**Entities (5 files)**
- `src/core/entities/product.entity.ts`
- `src/core/entities/category.entity.ts`
- `src/core/entities/product-variant.entity.ts`
- `src/core/entities/inventory.entity.ts`
- `src/core/entities/product-image.entity.ts`

**Migrations (5 files)**
- `src/migrations/1726350011000-CreateProductsTable.ts`
- `src/migrations/1726350012000-CreateCategoriesTable.ts`
- `src/migrations/1726350013000-CreateProductVariantsTable.ts`
- `src/migrations/1726350014000-CreateInventoryTable.ts`
- `src/migrations/1726350015000-CreateProductImagesTable.ts`

**Repositories (5 files)**
- `src/core/repositories/product.repository.ts`
- `src/core/repositories/category.repository.ts`
- `src/core/repositories/product-variant.repository.ts`
- `src/core/repositories/inventory.repository.ts`
- `src/core/repositories/product-image.repository.ts`

**Services (3 files)**
- `src/core/services/product.service.ts`
- `src/core/services/category.service.ts`
- `src/core/services/inventory.service.ts`

**Controllers (5 files)**
- `src/core/controllers/product.controller.ts`
- `src/core/controllers/category.controller.ts`
- `src/core/controllers/variant.controller.ts`
- `src/core/controllers/inventory.controller.ts`
- `src/core/controllers/product-image.controller.ts`

**Routes (5 files)**
- `src/core/routes/product.routes.ts`
- `src/core/routes/category.routes.ts`
- `src/core/routes/variant.routes.ts`
- `src/core/routes/inventory.routes.ts`
- `src/core/routes/product-image.routes.ts`

**DTOs (5 files)**
- `src/core/dto/product.dto.ts`
- `src/core/dto/category.dto.ts`
- `src/core/dto/variant.dto.ts`
- `src/core/dto/inventory.dto.ts`
- `src/core/dto/product-image.dto.ts`

**Tests (5 files)**
- `src/__tests__/integration/product.test.ts`
- `src/__tests__/integration/category.test.ts`
- `src/__tests__/integration/inventory.test.ts`
- `src/__tests__/integration/catalog-isolation.test.ts`
- `src/__tests__/integration/catalog-soft-delete.test.ts`

**Documentation (1 file)**
- `PHASE_4_COMPLETE.md`

**Total: 43 new files**

---

## Key Architectural Decisions

### Store Isolation
- All catalog entities use composite FK (id, store_id)
- Store filtering on all repository queries
- Cross-store data access prevented at DB & app level

### Soft Delete Strategy
- Products, Categories, Variants support soft delete
- Images hard-deleted with product
- Inventory immutable (never deleted)

### Inventory Management
- Atomic operations for reservations
- Transaction support for order processing
- Stock validation before order creation

### Search & Filtering
- PostgreSQL full-text search (tsvector)
- Indexed by category, price range, status
- Faceted search support via aggregations

### Publishing Workflow
- Status field controls visibility
- Scheduled publishing via background job
- Archive without deletion for analytics

---

## Testing Strategy

### Product Tests (15 tests)
- Create/read/update/delete
- Soft delete & restore
- SKU validation & uniqueness
- Status transitions
- Store isolation

### Category Tests (10 tests)
- Hierarchy (parent-child)
- Tree queries
- Breadcrumbs
- Reordering
- Soft delete with descendants

### Inventory Tests (12 tests)
- Stock tracking (available vs reserved)
- Reservation operations
- Reorder levels
- Low stock alerts
- Concurrent reservation handling

### Search & Filter Tests (8 tests)
- Full-text search
- Category filtering
- Price range filtering
- Status filtering
- Sorting options

### Soft Delete Tests (5 tests)
- Cascading soft delete
- Restore with dependencies
- Inventory preservation
- Image cleanup

**Total: 50+ catalog tests**

---

## Success Criteria

- ✅ All 5 entities created with proper relationships
- ✅ All 5 migrations run without errors
- ✅ All repositories support store isolation
- ✅ All services implement business logic
- ✅ All 18 routes respond correctly
- ✅ 50+ integration tests passing
- ✅ 90%+ code coverage
- ✅ Full documentation

---

## After Phase 4

### Phase 5: Order Management
- Orders table (references products)
- Order items (line items)
- Order status workflow (pending → shipped → delivered)
- Order history & cancellations

### Phase 6: Payment Processing
- Payment methods (credit card, PayPal, etc.)
- Transaction tracking
- Refund management
- Payment gateway integration

### Phase 7: Admin APIs
- Admin dashboard endpoints
- Analytics queries
- Reporting
- Configuration management

---

## Phase 4 Ready to Start! 🚀

All infrastructure in place:
- ✅ Database setup (PostgreSQL, TypeORM)
- ✅ Architecture patterns proven (Core Domain)
- ✅ Security framework established
- ✅ Testing infrastructure ready
- ✅ API framework configured

**Next command:** "Start Phase 4: Catalog Domain"

---

**Status:** ✅ Ready to implement Phase 4

**Estimated Time:** 10-15 hours for complete Catalog Domain

**Files to Create:** 43 new files (entities, migrations, repos, services, controllers, routes, DTOs, tests)

**Ready to proceed!** 🎯
