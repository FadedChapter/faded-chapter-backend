/**
 * Numeric Utility
 * Handles proper conversion of PostgreSQL NUMERIC types to JSON-safe numbers
 */

/**
 * Convert PostgreSQL NUMERIC string to JavaScript number
 * Handles cases where numeric values are returned as strings from database
 */
export function parseNumeric(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }

  // If it's already a number, return it
  if (typeof value === 'number') {
    return value;
  }

  // If it's a string, parse it to float
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Fallback
  return 0;
}

/**
 * Recursively fix numeric values in an object
 * Handles nested objects and arrays
 */
export function fixNumericValues<T>(obj: T, numericFields: string[] = []): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Dates are objects, but spreading one produces {} — a Date carries no
  // enumerable own properties. Every timestamp passing through here was being
  // flattened into an empty object, which is why the dashboard's "last updated"
  // could not render and DatePipe reported being handed [object Object].
  // Other wrapper types (Buffer, RegExp) would flatten the same way.
  if (obj instanceof Date || Buffer.isBuffer(obj) || obj instanceof RegExp) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => fixNumericValues(item, numericFields)) as any;
  }

  const result: any = { ...obj };

  // Common numeric fields in payments/refunds
  const commonNumericFields = [
    'amount',
    'total',
    'average',
    'value', // For chart data points
    'fee',
    'fee_gst',
    'pending_amount',
    'approved_amount',
    'rejected_amount',
    'total_amount',
    'subtotal',
    'tax_amount',
    'shipping_amount',
    'discount_amount',
    'successful_rate',
    'failed_rate',
    'refund_rate',
  ];

  const fieldsToCheck = [...commonNumericFields, ...numericFields];

  for (const [key, value] of Object.entries(result)) {
    if (fieldsToCheck.includes(key) && value !== null && value !== undefined) {
      result[key] = parseNumeric(value);
    } else if (typeof value === 'object') {
      result[key] = fixNumericValues(value, numericFields);
    }
  }

  return result as T;
}
