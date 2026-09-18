# Phase 0: Infrastructure & Foundation Setup

**Status**: ✅ Infrastructure complete  
**Date**: 2026-09-14  
**Database**: PostgreSQL 14+  
**Architecture**: Clean (Ports & Adapters)

---

## What's New in Phase 0

### 1. PostgreSQL Database Support
- Replaced SQLite with PostgreSQL for production-ready database
- TypeORM configured with connection pooling
- Migration framework ready for Phase 1

### 2. Environment Configuration
- Centralized `.env` configuration with Zod validation
- Supports development/test/production modes
- See `.env.example` for all variables

### 3. Store Context Middleware
- **Core v2.1 Requirement**: Every request has a `store_id`
- Automatic store isolation enforcement
- All queries filtered by `store_id`
- Prevents cross-store data access

### 4. Standardized Error Handling
- Typed error classes (ValidationError, AuthenticationError, etc.)
- Consistent error response format
- Proper HTTP status codes

### 5. Logging Infrastructure
- Winston logger with file and console transports
- Structured logging for debugging
- Log levels: error, warn, info, debug

### 6. Base Repository Pattern
- Abstract `BaseRepository<T>` class
- Automatic store isolation in all queries
- Soft delete support
- Consistent database operations

### 7. Docker Support
- `docker-compose.yml` for local PostgreSQL + pgAdmin
- One command setup for development database

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Set Up Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Start PostgreSQL (Docker)
```bash
docker-compose up -d
# PostgreSQL: localhost:5432
# pgAdmin: localhost:5050
```

### 4. Run Migrations
```bash
pnpm build
pnpm db:migrate
```

### 5. Start Development Server
```bash
pnpm dev
```

Server will be running at `http://localhost:3000`

---

## Project Structure

```
src/
├── core/
│   ├── config/
│   │   └── env.ts                 # Environment validation (Zod)
│   ├── database/
│   │   ├── postgres-data-source.ts # PostgreSQL setup
│   │   └── migrations/             # Database migrations (Phase 1)
│   ├── errors/
│   │   └── app-error.ts           # Error classes
│   ├── logging/
│   │   └── logger.ts              # Winston logger
│   ├── repository/
│   │   └── base-repository.ts     # Abstract base with store isolation
│   ├── store/
│   │   └── store-context.ts       # Store context & isolation middleware
│   └── ...existing auth, session, user modules...
├── routes/                         # API endpoints
└── server.ts                       # Express app
```

---

## Configuration (`.env`)

### Required
```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/faded_chapter_dev
JWT_SECRET=your-secret-key-min-32-chars
SESSION_SECRET=your-secret-key-min-32-chars
DEFAULT_STORE_ID=550e8400-e29b-41d4-a716-446655440000
```

### Optional (defaults provided)
```bash
PORT=3000
LOG_LEVEL=info
FEATURE_EMAIL_VERIFICATION=true
FEATURE_PASSWORD_RESET=true
```

See `.env.example` for all options.

---

## Database Initialization

### Create Database
```bash
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE faded_chapter_dev;"
```

### Run Migrations
```bash
pnpm db:migrate
```

### Revert Last Migration
```bash
pnpm db:migration:revert
```

---

## Store Context (Core v2.1)

Every request must have a `store_id`. This is enforced by `StoreContextMiddleware`:

```typescript
// In middleware (automatic)
req.storeContext = { storeId: '550e8400-e29b-41d4-a716-446655440000' };

// In handlers
const { storeId } = getStoreContext(req);
const record = await repository.findById(id, storeId); // ✅ store isolation enforced
```

**Key Rules**:
- ❌ Never query without store_id filter
- ❌ Never return data from other stores
- ✅ Always use BaseRepository methods
- ✅ Always attach store_id to records

---

## Error Handling

Use typed errors:

```typescript
import { ValidationError, NotFoundError, StoreIsolationError } from '../core/errors/app-error.js';

// Validation
if (!email.includes('@')) {
  throw new ValidationError('Invalid email format');
}

// Not found
if (!user) {
  throw new NotFoundError('User');
}

// Store isolation violation
if (user.store_id !== storeId) {
  throw new StoreIsolationError();
}
```

All errors automatically return proper HTTP status codes and error response format.

---

## Logging

```typescript
import { logInfo, logError, createChildLogger } from '../core/logging/logger.js';

// Quick logging
logInfo('User created', { userId, email });
logError('Database error', error, { operation: 'create_user' });

// Child logger for context
const logger = createChildLogger('UserService');
logger.info('Processing user registration');
```

---

## Phase 1 Readiness

Phase 0 provides the foundation for Phase 1 (Core Domain Implementation):

- ✅ PostgreSQL configured and running
- ✅ Environment validation in place
- ✅ Store context enforced on all requests
- ✅ Base repository with store isolation
- ✅ Error handling standardized
- ✅ Logging infrastructure ready
- ✅ Migration framework ready

**Next**: Create 11 Core Domain entities and their repositories (Phase 1)

---

## Troubleshooting

### PostgreSQL Connection Error
```
FATAL: database "faded_chapter_dev" does not exist
```
**Solution**: `docker-compose exec postgres psql -U postgres -c "CREATE DATABASE faded_chapter_dev;"`

### Port Already in Use
```
Error: listen EADDRINUSE :::3000
```
**Solution**: Change `PORT` in `.env` or kill the process: `lsof -ti :3000 | xargs kill -9`

### Migration Failed
```
QueryFailedError: relation "users" does not exist
```
**Solution**: Run migrations: `pnpm db:migrate`

---

## Next Steps

1. ✅ Phase 0 complete (infrastructure)
2. ➡️ Phase 1: Create 11 Core Domain tables + TypeORM entities
3. ➡️ Phase 2: Create repositories and services for each Core entity
4. ➡️ Phase 3: Create routes and API endpoints
5. ➡️ Phase 4: Write integration tests

---

**Created**: 2026-09-14  
**Framework**: Express 5.0 + TypeORM 1.1 + PostgreSQL 16  
**Language**: TypeScript 5.7
