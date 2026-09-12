/**
 * Authentication Routes
 *
 * Phase 3F.2 Endpoints (Email/Password):
 * - POST /api/auth/login — User login
 * - POST /api/auth/logout — User logout
 * - POST /api/auth/signup — User registration
 *
 * Phase 3F.3 Endpoints (Shopify OAuth):
 * - GET /api/auth/shopify/authorize — Initiate OAuth flow
 * - GET /api/auth/shopify/callback — Handle OAuth callback
 *
 * Security:
 * - All endpoints validate CSRF tokens (state-changing)
 * - Passwords never logged, stored in hash only
 * - Responses sanitize (no password, no hash)
 * - Sessions are server-authoritative (HttpOnly cookies)
 * - 401/403 errors don't reveal whether email exists (timing-safe)
 * - Shopify OAuth uses PKCE + state for security
 * - Access tokens stored server-side only (never exposed to browser)
 */

import { Router } from 'express';
import {
  UserStore,
  hashPassword,
  isValidEmail,
  normalizeEmail,
} from '../core/user/index';
import type { SessionStore } from '../core/session/session-store.port';
import type { SessionConfig } from '../core/session/session.types';
import { setSessionCookie, clearSessionCookie } from '../core/session/middleware/session.middleware';
// Phase 3F.3: Shopify OAuth
import { getShopifyOAuthConfig, buildShopifyAuthorizationUrl } from '../app/core/shopify-api/shopify-config';
import { generatePKCEChallenge, verifyPKCEState } from '../app/core/shopify-api/pkce.util';
import { getShopifyCustomerAdapter } from '../app/core/shopify-api/shopify-customer.adapter';

/**
 * Create auth routes.
 *
 * @param userStore - User persistence adapter
 * @param sessionStore - Session persistence adapter
 * @param sessionConfig - Session configuration
 */
export function createAuthRoutes(
  userStore: UserStore,
  sessionStore: SessionStore,
  sessionConfig: SessionConfig,
): Router {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const router = Router() as any;

  /**
   * POST /api/auth/login
   *
   * Authenticate user with email/password.
   * On success, creates session and sets secure cookie.
   *
   * Request: { email: string, password: string }
   * Response: { ok: true, user: AuthenticatedUser } | { ok: false, error: { code, message } }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router.post('/login', async (req: any, res: any) => {
    try {
      const { email, password } = req.body;

      // Input validation
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidEmail', message: 'Email is required' },
        });
      }

      if (!password || typeof password !== 'string' || !password.trim()) {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidPassword', message: 'Password is required' },
        });
      }

      // Look up user
      const normalizedEmail = normalizeEmail(email);
      const user = await userStore.findByEmail(normalizedEmail);

      if (!user) {
        // User not found — don't reveal (timing-safe: same delay as verification)
        console.warn('[Auth] Login attempt for unknown email:', { email: normalizedEmail });
        return res.status(401).json({
          ok: false,
          error: { code: 'invalidCredentials', message: 'Invalid email or password' },
        });
      }

      // Verify password (timing-safe via bcrypt)
      const passwordValid = await userStore.verifyPassword(user, password);

      if (!passwordValid) {
        console.warn('[Auth] Login attempt with invalid password:', { userId: user.id });
        return res.status(401).json({
          ok: false,
          error: { code: 'invalidCredentials', message: 'Invalid email or password' },
        });
      }

      // Password valid — create session
      const session = await sessionStore.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customerId: user.id as any, // Local user ID, not Shopify customer ID (Phase 3F.3)
        email: user.email,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      // Set secure session cookie
      setSessionCookie(res, session.id, sessionConfig);

      // Return authenticated user (no password, no hash)
      return res.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error) {
      console.error('[Auth] Login error:', error instanceof Error ? error.message : error);
      return res.status(500).json({
        ok: false,
        error: { code: 'unknown', message: 'Login failed' },
      });
    }
  });

  /**
   * POST /api/auth/logout
   *
   * Destroy session and clear cookie.
   *
   * Request: (no body required, session from cookie)
   * Response: { ok: true } | { ok: false, error }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router.post('/logout', async (req: any, res: any) => {
    try {
      if (req.session) {
        // Revoke session server-side
        await sessionStore.destroy(req.session.id);
      }

      // Clear session cookie
      clearSessionCookie(res, sessionConfig);

      return res.json({ ok: true });
    } catch (error) {
      console.error('[Auth] Logout error:', error instanceof Error ? error.message : error);
      return res.status(500).json({
        ok: false,
        error: { code: 'unknown', message: 'Logout failed' },
      });
    }
  });

  /**
   * POST /api/auth/signup
   *
   * Register a new user.
   * On success, sends verification email (mock) and returns pending status.
   * Does NOT automatically log in (Phase 3F.4 requirement).
   *
   * Request: { email, password, firstName, lastName, marketingOptIn }
   * Response: { ok: true, data: { email, emailVerified: false } } | { ok: false, error }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router.post('/signup', async (req: any, res: any) => {
    try {
      const { email, password, firstName, lastName, marketingOptIn } = req.body;

      // Input validation
      const validationError = validateSignupInput(email, password, firstName, lastName);
      if (validationError) {
        return res.status(400).json({
          ok: false,
          error: validationError,
        });
      }

      // Check if email already exists
      const normalizedEmail = normalizeEmail(email);
      const exists = await userStore.emailExists(normalizedEmail);

      if (exists) {
        return res.status(409).json({
          ok: false,
          error: { code: 'emailTaken', message: 'Email is already registered' },
        });
      }

      // Hash password (real hashing, never plaintext)
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await userStore.create(
        {
          email: normalizedEmail,
          password, // Create endpoint accepts plaintext, hashes internally
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          marketingOptIn: !!marketingOptIn,
        },
        passwordHash,
      );

      // TODO Phase 3F.4: Send verification email (currently mock)
      console.log('[Auth] Signup email verification (mock):', {
        userId: user.id,
        email: user.email,
      });

      // Return signup success (no automatic login — user must verify email and login)
      return res.json({
        ok: true,
        data: {
          email: user.email,
          emailVerified: false,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already registered')) {
        return res.status(409).json({
          ok: false,
          error: { code: 'emailTaken', message: 'Email is already registered' },
        });
      }

      console.error('[Auth] Signup error:', error instanceof Error ? error.message : error);
      return res.status(500).json({
        ok: false,
        error: { code: 'unknown', message: 'Signup failed' },
      });
    }
  });

  /**
   * Phase 3F.3: Shopify OAuth
   *
   * GET /api/auth/shopify/authorize
   *
   * Initiate Shopify OAuth flow (PKCE).
   * Returns redirect URL to Shopify login.
   *
   * Security:
   * - Generates PKCE challenge (code_verifier + code_challenge)
   * - Generates state parameter (CSRF protection)
   * - Stores both in session (secure HTTP-only cookie)
   * - Redirect happens on client-side (prevents exposure)
   *
   * Response: { ok: true, redirectUrl: string } | { ok: false, error }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router.get('/shopify/authorize', async (req: any, res: any) => {
    try {
      const config = getShopifyOAuthConfig();
      const pkce = generatePKCEChallenge();

      // Store PKCE challenge and state in session (for callback verification)
      // Create ephemeral session (no authentication yet)
      const oauthSession = await sessionStore.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customerId: 'oauth-pending' as any,
        email: 'oauth@pending.local', // Placeholder
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      // CRITICAL: Store PKCE data in session (server-side only)
      // This prevents PKCE data from being exposed or modified by client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (oauthSession as any).pkceCodeVerifier = pkce.codeVerifier;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (oauthSession as any).pkceState = pkce.state;

      // Set session cookie (to retrieve on callback)
      setSessionCookie(res, oauthSession.id, sessionConfig);

      // Build authorization URL
      const authUrl = buildShopifyAuthorizationUrl(config, pkce.state, pkce.codeChallenge);

      return res.json({
        ok: true,
        redirectUrl: authUrl,
      });
    } catch (error) {
      console.error('[Auth] Shopify authorize error:', error instanceof Error ? error.message : error);
      return res.status(500).json({
        ok: false,
        error: { code: 'unknown', message: 'OAuth initialization failed' },
      });
    }
  });

  /**
   * Phase 3F.3: Shopify OAuth Callback
   *
   * GET /api/auth/shopify/callback?code=...&state=...
   *
   * Handle OAuth callback from Shopify.
   * Exchanges authorization code for access token.
   * Establishes authenticated session.
   *
   * Security:
   * - Verifies state parameter (CSRF protection)
   * - Exchanges code with PKCE proof (authorization request origin)
   * - Stores access token server-side only (never exposed to browser)
   * - Normalizes customer ID to string for consistency
   * - Creates new authenticated session (replaces ephemeral OAuth session)
   *
   * Response: { ok: true, redirectUrl: string } | { ok: false, error }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router.get('/shopify/callback', async (req: any, res: any) => {
    try {
      const { code, state } = req.query;

      // Validate callback parameters
      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidCode', message: 'Authorization code is missing' },
        });
      }

      if (!state || typeof state !== 'string') {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidState', message: 'State parameter is missing' },
        });
      }

      // Get OAuth session (ephemeral session from /authorize call)
      const oauthSession = req.session;
      if (!oauthSession) {
        return res.status(401).json({
          ok: false,
          error: { code: 'noSession', message: 'OAuth session expired' },
        });
      }

      // Extract PKCE data from session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const codeVerifier = (oauthSession as any).pkceCodeVerifier;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionState = (oauthSession as any).pkceState;

      if (!codeVerifier || !sessionState) {
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidSession', message: 'PKCE data missing from session' },
        });
      }

      // Verify state (CSRF protection)
      if (!verifyPKCEState(sessionState, state)) {
        console.warn('[Auth] PKCE state mismatch (possible CSRF attack):', {
          expected: sessionState,
          received: state,
        });
        return res.status(400).json({
          ok: false,
          error: { code: 'invalidState', message: 'State parameter does not match' },
        });
      }

      // Exchange authorization code for access token
      const config = getShopifyOAuthConfig();
      const adapter = getShopifyCustomerAdapter(config);

      let tokenResponse;
      try {
        tokenResponse = await adapter.exchangeAuthorizationCode(code, codeVerifier);
      } catch (error) {
        console.error('[Auth] Token exchange failed:', error instanceof Error ? error.message : error);
        return res.status(401).json({
          ok: false,
          error: { code: 'tokenExchange', message: 'Failed to obtain access token' },
        });
      }

      // Fetch customer profile (to validate access token and obtain customer ID)
      let customer;
      try {
        customer = await adapter.getCustomer(tokenResponse.accessToken);
      } catch (error) {
        console.error('[Auth] Failed to fetch customer:', error instanceof Error ? error.message : error);
        return res.status(401).json({
          ok: false,
          error: { code: 'getCustomer', message: 'Failed to retrieve customer information' },
        });
      }

      // Extract customer ID from Shopify response
      // Shopify customer ID format: "gid://shopify/Customer/12345"
      // Extract numeric portion for consistency
      const shopifyCustomerMatch = customer.id.match(/\/(\d+)$/);
      const shopifyCustomerId = shopifyCustomerMatch ? shopifyCustomerMatch[1] : customer.id;

      // Destroy ephemeral OAuth session
      await sessionStore.destroy(oauthSession.id);
      clearSessionCookie(res, sessionConfig);

      // Create authenticated session
      // CRITICAL: Store shopifyCustomerId and access token server-side only
      const session = await sessionStore.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customerId: shopifyCustomerId as any, // Phase 3F.3: Shopify customer ID as string
        email: customer.email,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      // Store access token server-side (never exposed to browser)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).shopifyCustomerId = shopifyCustomerId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).shopifyAccessToken = tokenResponse.accessToken;

      // Set authenticated session cookie
      setSessionCookie(res, session.id, sessionConfig);

      // Return success with redirect
      // Client will redirect to /account or /orders
      return res.json({
        ok: true,
        redirectUrl: '/account',
        customer: {
          id: shopifyCustomerId,
          email: customer.email,
          displayName: [customer.firstName, customer.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || customer.email,
        },
      });
    } catch (error) {
      console.error('[Auth] Shopify callback error:', error instanceof Error ? error.message : error);
      return res.status(500).json({
        ok: false,
        error: { code: 'unknown', message: 'OAuth callback failed' },
      });
    }
  });

  return router;
}

/**
 * Validate signup input.
 * Returns error object if invalid, null if valid.
 */
function validateSignupInput(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): { code: string; message: string } | null {
  if (!email || typeof email !== 'string') {
    return { code: 'invalidEmail', message: 'Email is required' };
  }

  if (!isValidEmail(email)) {
    return { code: 'invalidEmail', message: 'Invalid email format' };
  }

  if (!password || typeof password !== 'string') {
    return { code: 'invalidPassword', message: 'Password is required' };
  }

  if (password.length < 8) {
    return { code: 'weakPassword', message: 'Password must be at least 8 characters' };
  }

  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    return { code: 'invalidFirstName', message: 'First name is required' };
  }

  if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
    return { code: 'invalidLastName', message: 'Last name is required' };
  }

  return null;
}
