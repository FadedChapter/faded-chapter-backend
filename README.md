# Faded Chapter Backend API

Express.js backend for Faded Chapter e-commerce platform.

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev     # Runs with tsx watch (http://localhost:3000)

# Production
npm run build   # Compile TypeScript
npm start       # Run compiled server
```

## Architecture

```
src/
├── server.ts           Express app setup
├── core/               Backend services
│   ├── session/        Session management (HTTP-only cookies)
│   ├── user/           User store, password hashing
│   └── security/       CSP, CSRF, security middleware
├── routes/             API endpoints
│   ├── auth.routes.ts  Authentication (login, signup, logout)
│   └── orders.routes.ts Order retrieval
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset
- `GET /api/auth/reset-password/:token` - Reset form

### Orders
- `GET /api/orders` - Customer orders (authenticated)
- `GET /api/orders/:id` - Order detail

## Environment Variables

```bash
# .env or .env.local
PORT=3000
NODE_ENV=development
SITE_URL=http://localhost:3000
```

## Dependencies

- **express** - Web framework
- **helmet** - Security headers
- **bcryptjs** - Password hashing
- **cookie-parser** - Cookie handling
- **@faded-chapter/types** - Shared TypeScript types

## Development

### Running Locally

```bash
# Terminal 1: Backend API
npm run dev     # :3000

# Terminal 2: Frontend (from faded-chapter repo)
cd ../faded-chapter
pnpm start      # :4200
```

### Testing

```bash
npm test          # Run tests
npm test:ui       # UI test runner
```

### Linting

```bash
npm run lint      # Check
npm run lint:fix  # Fix
```

## Database

Currently using in-memory store. Migrate to database for production:
- Session store: `src/core/session/adapters/inmemory-session-store.ts`
- User store: `src/core/user/adapters/inmemory-user-store.ts`

## License

MIT
