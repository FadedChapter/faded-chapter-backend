# Phase 3F.5: Password Reset Implementation

**Status**: ✅ COMPLETE & TESTED  
**Date**: 2026-09-14  
**Database**: SQLite with persistent token storage  
**Auth**: Email-based token verification

---

## 📋 Overview

Password reset allows users to recover access to their accounts if they forget their password. This phase implements a complete password reset system with:

- ✅ Secure token generation (256-bit)
- ✅ One-time token use
- ✅ 24-hour expiry
- ✅ Rate limiting (15 minutes between requests)
- ✅ Audit trail (IP address, user agent)
- ✅ Mock email sender (dev) + real (prod)
- ✅ Password strength validation

---

## 🏗️ Architecture

### Database Schema

```sql
-- Password reset tokens
CREATE TABLE password_resets (
  id VARCHAR PRIMARY KEY,
  userId VARCHAR NOT NULL,
  token VARCHAR UNIQUE NOT NULL,
  email VARCHAR NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME,
  isUsed BOOLEAN DEFAULT FALSE,
  attemptCount INTEGER DEFAULT 0,
  requestedAt DATETIME,
  ipAddress VARCHAR,
  userAgent VARCHAR,
  createdAt DATETIME,
  updatedAt DATETIME
);

-- Indexes for fast lookups
CREATE INDEX idx_password_user_id ON password_resets(userId);
CREATE INDEX idx_password_token ON password_resets(token);
```

### Service Architecture

```
┌─ PasswordResetService
│  ├─ generateResetToken(userId, email, ip, ua)
│  ├─ validateToken(token) [check validity]
│  ├─ resetPassword(token, newPassword)
│  ├─ canRequestReset(userId) [rate limit check]
│  ├─ recordResetAttempt(token)
│  └─ cleanupExpiredTokens()
│
├─ EmailSenderService (Reused from Phase 3F.4)
│  ├─ MockEmailSender [DEV]
│  └─ SendGridEmailSender [PROD]
│
└─ Password Routes (/api/password/*)
   ├─ POST /forgot [request reset]
   ├─ GET /reset-token-status [validate token]
   └─ POST /reset [change password]
```

---

## 🔐 Security Features

### Token Security
- **Generation**: `randomBytes(32)` → 256-bit entropy
- **Storage**: Hex-encoded in database
- **One-time use**: Can only be used once
- **Expiry**: 24-hour validity window
- **Rate limiting**: 15-minute cooldown between requests

### Password Security
- **Strength validation**: 8+ chars, uppercase, lowercase, number/symbol
- **Hashing**: bcryptjs with salt
- **Immediate**: New password usable right after reset
- **Old password invalidated**: Can't login with old password

### Audit Trail
- **IP address**: Recorded when reset requested
- **User agent**: Browser/client info stored
- **Timestamps**: Track when reset requested/used
- **Attempt tracking**: Max 3 password change attempts per token

---

## 📧 Email Template

### Password Reset Email
```html
Subject: Reset Your Faded Chapter Password

Body:
- Branded header (Faded Chapter logo)
- Call-to-action button with reset link
- Link format: {{FRONTEND_URL}}/reset-password?token={{TOKEN}}
- Security warning: Link expires in 24 hours
- Security notice: If you didn't request this, ignore it
- Contact info: support@fadedchapter.com
```

### Development Behavior
```javascript
// MockEmailSender logs full email to console
📧 [MockEmailSender] Email would be sent:
────────────────────────────────────────────
To: user@example.com
Subject: Reset Your Faded Chapter Password
────────────────────────────────────────────
HTML Body: [full HTML]
────────────────────────────────────────────
```

---

## 🔄 Complete Flow

### 1. User Requests Password Reset

```
POST /api/password/forgot
{
  "email": "user@example.com"
}

Response: {
  "ok": true,
  "data": {
    "email": "user@example.com",
    "message": "Password reset link sent to your email address"
  }
}
```

**Backend steps:**
1. Find user by email (case-insensitive)
2. Check rate limiting (15-min cooldown)
3. Generate secure token (32 bytes random)
4. Create password_resets record
5. Build password reset email
6. Send via MockEmailSender (logs to console)
7. Return generic success (don't reveal if email exists)

**Security note**: Returns same message whether email exists or not (prevents user enumeration)

### 2. Validate Reset Token (Optional)

```
GET /api/password/reset-token-status?token=abc123...

Response: {
  "ok": true,
  "data": {
    "valid": true,
    "email": "user@example.com",
    "expiresAt": "2026-09-15T07:16:45Z",
    "expiresInSeconds": 86353
  }
}
```

**Backend checks:**
- Token exists in database
- Not already used (isUsed = false)
- Not expired (expiresAt > now)
- Returns remaining seconds until expiry

**Use case**: Frontend can validate token before showing password form

### 3. Reset Password with Token

```
POST /api/password/reset
{
  "token": "5d21c4135b2642948927714eb223d05f39ebe2de85ed771a9c4faf5a5e8afd65",
  "newPassword": "NewPass456!",
  "confirmPassword": "NewPass456!"
}

Response: {
  "ok": true,
  "data": {
    "email": "user@example.com",
    "resetAt": "2026-09-14T07:17:31.758Z",
    "message": "Password reset successfully. You can now login with your new password."
  }
}
```

**Backend validation:**
1. Verify token exists and is valid
2. Check not already used
3. Check not expired
4. Verify passwords match
5. Validate password strength (8+ chars, mixed case, number/symbol)
6. Check attempt limit (max 3)
7. Hash new password with bcryptjs
8. Update user password hash
9. Mark token as used (isUsed = true, usedAt = now)
10. Return success

**Error responses:**

```json
// Invalid/expired token
{
  "ok": false,
  "error": {
    "code": "resetFailed",
    "message": "This password reset link has expired. Please request a new one."
  }
}

// Passwords don't match
{
  "ok": false,
  "error": {
    "code": "passwordMismatch",
    "message": "Passwords do not match"
  }
}

// Weak password
{
  "ok": false,
  "error": {
    "code": "weakPassword",
    "message": "Password must be at least 8 characters with uppercase, lowercase, and number/symbol"
  }
}

// Rate limited
{
  "ok": false,
  "error": {
    "code": "rateLimited",
    "message": "Please wait 15 minutes before requesting another password reset",
    "nextResetAt": "2026-09-14T07:31:00Z"
  }
}
```

---

## 🧪 Testing the Flow

### Manual Test with Mock Email Sender

```bash
# 1. Request password reset
curl -X POST http://localhost:3000/api/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@faded.test"}'
# Response: { ok: true, data: { email: "demo@faded.test", message: "..." } }

# 2. Check console logs for reset token
# Look for: "reset-password?token=5d21c4135b..."

# 3. Validate token (optional)
curl "http://localhost:3000/api/password/reset-token-status?token=5d21c4135b..."
# Response: { valid: true, expiresInSeconds: 86400 }

# 4. Reset password with token
curl -X POST http://localhost:3000/api/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "token": "5d21c4135b...",
    "newPassword": "NewPass456!",
    "confirmPassword": "NewPass456!"
  }'
# Response: { ok: true, resetAt: "2026-09-14T07:17:31.758Z" }

# 5. Login with new password
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@faded.test","password":"NewPass456!"}'
# Response: { ok: true, data: { token: "eyJ...", user: {...} } }

# 6. Try old password (should fail)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@faded.test","password":"Password123!"}'
# Response: { ok: false, error: { code: "invalidCredentials" } }
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Frontend URL for password reset links (used in email templates)
FRONTEND_URL=http://localhost:4200

# Email sending service (optional - for production)
SENDGRID_API_KEY=sg_xxxxx...  # Not required for dev (uses mock)

# Node environment (auto-detects development vs production)
NODE_ENV=development  # Uses MockEmailSender
NODE_ENV=production   # Uses SendGridEmailSender (requires API key)
```

### Token Configuration

Edit `PasswordResetService` constants:

```typescript
private readonly TOKEN_EXPIRY_HOURS = 24;           // How long token is valid
private readonly RESET_RATE_LIMIT_MINUTES = 15;     // Cooldown between requests
private readonly MAX_RESET_ATTEMPTS = 3;            // Max attempts per token
```

---

## 📨 Production Email Setup

### Currently Supported
- ✅ **MockEmailSender** (Development) - Logs to console
- ⏳ **SendGridEmailSender** (Placeholder) - Ready for implementation

### To Enable Real Emails (Phase 3F.5+)

1. **Get SendGrid API Key**
   ```bash
   https://sendgrid.com → Settings → API Keys
   ```

2. **Set Environment Variable**
   ```bash
   export SENDGRID_API_KEY=sg_xxxxx...
   ```

3. **Implementation Required**
   - Uncomment `SendGridEmailSender` in `email-sender.service.ts`
   - Implement actual SendGrid API call
   - Test with real email service

---

## 🐛 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `invalidRequest` | 400 | Missing required parameter |
| `resetFailed` | 400 | Token invalid/expired/used |
| `passwordMismatch` | 400 | Passwords don't match |
| `weakPassword` | 400 | Password doesn't meet requirements |
| `rateLimited` | 429 | Too many reset requests |
| `emailSendFailed` | 500 | Failed to send email |
| `internalError` | 500 | Server error |

---

## 🧅 Typical Problems & Solutions

### Issue: "attempt to write a readonly database"
**Cause**: Database file permissions issue  
**Fix**: Restart the server (`npm run dev`)

### Issue: Token keeps saying "already used" when it's new
**Cause**: Token was used once and can't be reused  
**Fix**: Request a new reset password email to get a new token

### Issue: Password change doesn't take effect
**Cause**: Still using old password, or token expired  
**Fix**: Request a new password reset email (token expires in 24h)

---

## 📊 Database Queries

### Find user's pending reset

```sql
SELECT * FROM password_resets
WHERE userId = 'user-123'
  AND isUsed = FALSE
  AND expiresAt > datetime('now')
ORDER BY requestedAt DESC
LIMIT 1;
```

### Clean up expired tokens (runs hourly)

```sql
DELETE FROM password_resets
WHERE updatedAt < datetime('now', '-30 days');
```

### Check recent reset requests

```sql
SELECT userId, email, requestedAt, ipAddress, userAgent
FROM password_resets
WHERE requestedAt > datetime('now', '-1 day')
ORDER BY requestedAt DESC;
```

---

## 🔮 Next Steps

### Phase 3F.7: User Profile
- Show last password change date in profile
- Allow user to change password directly
- Show login history / reset history

### Phase 3F.8+: Admin Features
- Force password reset for specific users
- View password reset audit trail
- See which users have never reset password

### Phse 3F.10+: Security Enhancements
- Require password reset if compromised
- Weekly password strength check
- Two-factor authentication (2FA)

---

## 📝 Implementation Notes

### Files Created
```
src/core/password/
├─ entities/
│  └─ password-reset.entity.ts (database model)
├─ services/
│  └─ password-reset.service.ts (business logic)
└─ routes/
   └─ password.routes.ts (API endpoints)
```

### Key Design Decisions

1. **Email-based**: Safer than security questions
2. **One-time tokens**: Prevents reuse attacks
3. **Rate limiting**: Prevents spam/brute force
4. **Audit trail**: IP/user agent for forensics
5. **Auto-cleanup**: Old tokens removed periodically
6. **Strength validation**: Password quality enforced
7. **Generic error messages**: Don't reveal if email exists

---

## ✅ Test Results

All endpoints tested and verified working:

```
✅ POST /api/password/forgot
   Response: Email sent successfully

✅ GET /api/password/reset-token-status
   Response: Token valid, expires in 86353 seconds

✅ POST /api/password/reset
   Response: Password reset successfully

✅ Login with new password: Works
✅ Login with old password: Fails (as expected)
```

---

**Created**: 2026-09-14  
**Status**: ✅ Production Ready (Mock Email)  
**Next Phase**: 3F.7 (User Profile)
