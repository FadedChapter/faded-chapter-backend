/**
 * Email Utility Functions
 */

/**
 * Normalize an email for case-insensitive comparison.
 * Trims whitespace and converts to lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate email format (basic).
 * Does NOT verify the email exists; just checks basic format.
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 simplified (not exhaustive)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
