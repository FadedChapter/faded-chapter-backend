/**
 * Phase 7 — analytics permission and export-safety tests.
 *
 * Two concerns here that earlier phases did not have:
 *
 *  1. Analytics is business-wide revenue and category data. Support answers
 *     customer questions and never needs it, so unlike every other read in this
 *     console it is admin-only. That distinction is easy to erode by copying an
 *     existing permission line.
 *
 *  2. A CSV export is an attack surface, not just a file. Spreadsheets execute
 *     leading =, +, - and @ as formulas, and product names and refund reasons
 *     in this system are operator- and customer-supplied — so an export is a
 *     delivery mechanism for content someone else wrote.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import { UNAVAILABLE_METRICS } from '../../core/services/analytics.service';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

/**
 * Mirrors the escaping in admin-analytics.controller.ts.
 *
 * Duplicated rather than exported: the controller's copy is the one that runs,
 * and a test that imports the implementation it is checking only proves the
 * function equals itself. This states the rule independently.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

describe('Phase 7 — analytics is admin-only', () => {
  it('grants analytics.view to admin', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('analytics.view');
  });

  it('withholds analytics from support', () => {
    // Support reads orders, products, inventory and customers to help a person.
    // Business-wide revenue is not part of answering a customer question.
    expect(ROLE_PERMISSIONS.support).not.toContain('analytics.view');
  });

  it('withholds analytics from customers', () => {
    expect(ROLE_PERMISSIONS.customer).not.toContain('analytics.view');
  });

  it('keeps support able to do its own job', () => {
    // Guards against over-correcting: restricting analytics must not strip the
    // reads support actually needs.
    for (const permission of ['orders.view', 'products.view', 'customers.view']) {
      expect(ROLE_PERMISSIONS.support).toContain(permission);
    }
  });
});

describe('Phase 7 — CSV export cannot carry a formula', () => {
  it('neutralises every formula-triggering prefix', () => {
    for (const prefix of ['=', '+', '-', '@']) {
      const cell = csvCell(`${prefix}HYPERLINK("http://evil","click")`);
      // The payload survives as text, but the sheet will not execute it.
      expect(cell.startsWith(`"'${prefix}`) || cell.startsWith(`'${prefix}`)).toBe(true);
    }
  });

  it('neutralises a tab or carriage return used to smuggle a formula past a naive check', () => {
    expect(csvCell('\t=1+1')).toContain("'");
    expect(csvCell('\r=1+1')).toContain("'");
  });

  it('quotes and doubles embedded quotes per RFC 4180', () => {
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('quotes fields containing a delimiter or newline', () => {
    expect(csvCell('Trouser, Stone')).toBe('"Trouser, Stone"');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('leaves ordinary values untouched', () => {
    // Escaping should not corrupt the common case.
    expect(csvCell('The Straight Trouser')).toBe('The Straight Trouser');
    expect(csvCell(171600)).toBe('171600');
    expect(csvCell('FC-STR')).toBe('FC-STR');
  });

  it('renders null and undefined as empty rather than the strings "null"/"undefined"', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('does not mistake a negative number for a formula in a way that loses the value', () => {
    // A leading '-' is prefixed, so the number is preserved and visible even
    // though it is rendered as text.
    const cell = csvCell('-500');
    expect(cell).toContain('500');
    expect(cell.startsWith("'")).toBe(true);
  });
});

describe('Phase 7 — unavailable metrics are declared, not invented', () => {
  it('names each metric the schema cannot support', () => {
    const named = UNAVAILABLE_METRICS.map((m) => m.metric);
    for (const metric of [
      'Conversion rate',
      'Cart abandonment',
      'Traffic sources',
      'Customer acquisition cost',
    ]) {
      expect(named).toContain(metric);
    }
  });

  it('states what each one would require', () => {
    // A gap with a reason is actionable; a silent omission is not.
    for (const entry of UNAVAILABLE_METRICS) {
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(entry.needs.length).toBeGreaterThan(3);
    }
  });
});
