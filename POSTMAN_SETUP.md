# Postman Setup Guide - Faded Chapter API

Complete guide to testing the Faded Chapter Backend API using Postman.

## 📥 Import Collection & Environment

### Step 1: Download Postman
- [Download Postman](https://www.postman.com/downloads/)
- Install and open the application

### Step 2: Import Collection
1. Open Postman
2. Click **"Import"** (top-left corner)
3. Select **"Upload Files"**
4. Choose: `Faded-Chapter-API.postman_collection.json`
5. Click **"Import"**

### Step 3: Import Environment
1. Click **"Import"** again
2. Select **"Upload Files"**
3. Choose: `Faded-Chapter-Dev.postman_environment.json`
4. Click **"Import"**

### Step 4: Select Environment
1. Top-right corner, click environment dropdown
2. Select **"Faded Chapter - Development"**
3. You should see variables populated:
   - `base_url`: http://localhost:3000
   - `auth_token`: (empty, will be set after login)
   - `demo_email`: demo@faded.test
   - `demo_password`: Password123!

---

## 🚀 Quick Start

### Test 1: Health Check
1. Open **"Health Check"** request
2. Click **Send**
3. Expected response: `{ "ok": true, "timestamp": "..." }`

### Test 2: Login with Demo User
1. Open **"Authentication"** → **"Login"**
2. See pre-filled request:
   ```json
   {
     "email": "demo@faded.test",
     "password": "Password123!"
   }
   ```
3. Click **Send**
4. Response should include JWT token

### Test 3: Copy Token to Environment
After successful login:
1. Copy the `token` from response
2. Go to **"Environment"** (top-right)
3. Click **"Faded Chapter - Development"**
4. Find `auth_token` variable
5. Paste the token into the **"Current value"** field
6. Click **Save** (Ctrl+S)

### Test 4: Logout (Using Token)
1. Open **"Authentication"** → **"Logout"**
2. This request uses `{{auth_token}}` in the Authorization header
3. Click **Send**
4. Response: `{ "ok": true }`

---

## 📋 API Endpoints

### Authentication Endpoints

#### 1. **Signup** - Create new account
```
POST /api/auth/signup
```

**Parameters**:
| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| email | string | ✅ | user@example.com |
| password | string | ✅ | SecurePass123! |
| firstName | string | ✅ | John |
| lastName | string | ✅ | Doe |
| marketingOptIn | boolean | ❌ | true |

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number or symbol (!@#$%^&*)

**Example Request**:
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "marketingOptIn": true
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "email": "newuser@example.com",
    "emailVerified": false
  }
}
```

**Error Responses**:
- `400 Bad Request` - Validation failed (weak password, invalid email)
- `409 Conflict` - Email already registered

---

#### 2. **Login** - Authenticate user
```
POST /api/auth/login
```

**Parameters**:
| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| email | string | ✅ | user@example.com |
| password | string | ✅ | SecurePass123! |

**Example Request**:
```json
{
  "email": "demo@faded.test",
  "password": "Password123!"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-demo",
      "email": "demo@faded.test",
      "emailVerified": true
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized` - Invalid credentials
- `400 Bad Request` - Missing parameters

---

#### 3. **Logout** - End session
```
POST /api/auth/logout
Authorization: Bearer {token}
```

**Headers Required**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response** (200):
```json
{
  "ok": true
}
```

---

#### 4. **Forgot Password** - Reset password
```
POST /api/auth/forgot-password
```

**Parameters**:
| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| email | string | ✅ | user@example.com |

**Example Request**:
```json
{
  "email": "demo@faded.test"
}
```

**Response** (200):
```json
{
  "ok": true,
  "data": {
    "email": "demo@faded.test"
  }
}
```

---

## 🔐 JWT Token Management

### What is JWT?
JWT (JSON Web Token) is a secure way to authenticate requests. After login, you receive a token that proves your identity.

### Token Format
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLWRlbW8iLCJlbWFpbCI6ImRlbW9AZmFkZWQudGVzdCIsImlhdCI6MTcxNjQzMjAwMH0.SIGNATURE
```

### Token Lifetime
- **Valid for**: 24 hours
- **After expiry**: Must login again to get new token
- **Storage**: Postman automatically stores in environment variable

### Using Token in Requests
The `Logout` request already has the Authorization header configured:
```
Authorization: Bearer {{auth_token}}
```

The `{{auth_token}}` gets replaced with your actual token from the environment.

---

## 🧪 Test Scenarios

### Scenario 1: Complete Flow
1. **Signup** - Create new user
2. **Copy token** to environment
3. **Logout** - End session
4. **Login** - Authenticate with new credentials
5. **Copy token** - Store new token

### Scenario 2: Error Handling
Test error cases:
- Login with wrong password → 401
- Signup with duplicate email → 409
- Signup with weak password → 400
- Request without Authorization header → 401

### Scenario 3: Token Expiry (Manual Test)
1. Login and copy token
2. Wait 24 hours
3. Try to use old token
4. Response: Unauthorized

---

## 🌐 Environment Variables

### Available Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `base_url` | API base URL | http://localhost:3000 |
| `auth_token` | JWT token (set after login) | eyJhbGc... |
| `test_email` | Test user email | test@faded.test |
| `test_password` | Test user password | TestPass123! |
| `demo_email` | Demo account email | demo@faded.test |
| `demo_password` | Demo account password | Password123! |

### How to Use Variables
In request body or headers, use: `{{variable_name}}`

Example:
```json
{
  "email": "{{test_email}}",
  "password": "{{test_password}}"
}
```

### Change Environment Variables
1. Click environment dropdown (top-right)
2. Click **"Edit"** next to environment name
3. Change any variable value
4. Click **"Save"**

---

## 📝 Create Custom Requests

### Add New Request
1. Right-click **"Authentication"** folder
2. Select **"Add Request"**
3. Name it: "My Custom Request"
4. Set method: **POST** (or GET, PUT, DELETE)
5. URL: `{{base_url}}/api/auth/...`
6. Add body and headers
7. Click **Save**

### Example: Custom Signup
```javascript
// Folder: Authentication
// Name: Custom Signup Test

POST {{base_url}}/api/auth/signup

Header:
Content-Type: application/json

Body (JSON):
{
  "email": "customuser@faded.test",
  "password": "CustomPass123!",
  "firstName": "Custom",
  "lastName": "User",
  "marketingOptIn": false
}
```

---

## 🔍 Debugging Tips

### Check Response Status
After clicking Send, look at:
- **Status code** (top-right of response panel)
- **Response body** (JSON at bottom)
- **Headers** (shows CORS, Content-Type, etc.)

### View Full Request
Before sending:
1. Click **"Code"** (right side of request)
2. See formatted request with all headers
3. Useful for debugging CORS or header issues

### Check Environment Variables
1. Click environment dropdown
2. Click **"Edit"**
3. See all current variable values
4. `Initial value` = shared with team
5. `Current value` = local only

---

## 🐛 Common Issues

### Issue: "Variable not defined"
**Error**: `Could not resolve variable base_url`
**Fix**: 
1. Make sure environment is selected (top-right dropdown)
2. Verify `Faded Chapter - Development` is selected

### Issue: "Cannot send request with undefined variable"
**Error**: `Cannot use undefined variable in request`
**Fix**:
1. Open environment (dropdown → Edit)
2. Check if `auth_token` has a value
3. If empty, login first to get token

### Issue: "Connection refused"
**Error**: `Error: connect ECONNREFUSED 127.0.0.1:3000`
**Fix**:
1. Make sure backend is running: `npm run dev`
2. Check `base_url` is correct: http://localhost:3000
3. Verify no firewall blocking port 3000

### Issue: "Invalid token"
**Error**: `401 Unauthorized`
**Fix**:
1. Login again to get fresh token
2. Copy new token to environment
3. Make sure token hasn't expired (24h limit)

---

## 📚 Additional Resources

### Learn JWT
- [jwt.io](https://jwt.io) - JWT debugger and documentation
- [Auth0 JWT Guide](https://auth0.com/docs/secure/tokens/json-web-tokens)

### Postman Documentation
- [Getting Started](https://learning.postman.com/docs/getting-started/overview/)
- [Collections](https://learning.postman.com/docs/collections/collections-overview/)
- [Environments](https://learning.postman.com/docs/sending-requests/managing-environments/)

### API Architecture
- **Phase 3F.2**: Authentication endpoints ✅
- **Phase 3F.3**: Shopify OAuth (coming)
- **Phase 3F.4**: Password reset (coming)
- **Phase 3F.5**: Email verification (coming)

---

## 💡 Tips & Tricks

### Bulk Create Test Users
1. Open **"Test Scenarios"** → **"Full Flow"**
2. Change email in body to: `test-{{$timestamp}}@faded.test`
3. Click **Send** multiple times
4. Each creates unique user with timestamp

### Auto-set Token After Login
Advanced: Use Tests tab to auto-save token:
```javascript
// In "Tests" tab of Login request
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.environment.set("auth_token", jsonData.data.token);
}
```

### Share Collection with Team
1. In Postman, click **"Share"** button
2. Export collection as JSON
3. Share file via Git or email
4. Team imports same collection

---

## 🆘 Need Help?

**Backend Issues?**
- Check server running: `npm run dev`
- Check logs in terminal
- Verify SQLite database exists: `faded-chapter.db`

**Postman Issues?**
- [Postman Community](https://community.postman.com/)
- [Stack Overflow - Postman tag](https://stackoverflow.com/questions/tagged/postman)

---

**Version**: 1.0  
**Last Updated**: 2024-09-14  
**Database**: SQLite (persistent)  
**API Status**: Phase 3F.2 Authentication Complete ✅
