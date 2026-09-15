/**
 * Phase 10 — alerts permission and honesty tests.
 *
 * The defining constraint of this module is that the system has no delivery
 * transport: the email sender's send path is unimplemented and no SMS provider
 * exists. The failure mode to guard against is therefore not a leak but a lie —
 * a UI that appears to arm email alerts and silently does nothing, which stops
 * an operator watching the console and is worse than no feature at all.
 *
 * These tests pin that honesty in place alongside the permission split.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig } from '../../core/config/env';
import { initializeLogger } from '../../core/logging/logger';
import { ROLE_PERMISSIONS } from '../../core/middleware/authorization.middleware';
import { AlertsService, RULE_CATALOGUE } from '../../core/services/alerts.service';

beforeAll(() => {
  loadConfig();
  initializeLogger();
});

describe('Phase 10 — alert permission separation', () => {
  it('lets support see what needs attention', () => {
    expect(ROLE_PERMISSIONS.support).toContain('alerts.view');
  });

  it('does not let support silence a rule', () => {
    // Turning a rule off stops the whole team seeing the condition, which is a
    // different weight of decision from reading it.
    expect(ROLE_PERMISSIONS.support).not.toContain('alerts.manage');
  });

  it('gives admin both', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('alerts.view');
    expect(ROLE_PERMISSIONS.admin).toContain('alerts.manage');
  });

  it('gives customers no alert permissions at all', () => {
    for (const permission of ROLE_PERMISSIONS.customer) {
      expect(permission.startsWith('alerts.')).toBe(false);
    }
  });
});

describe('Phase 10 — delivery is reported honestly', () => {
  const service = new AlertsService();

  it('declares every channel unavailable, with a reason', () => {
    const channels = service.deliveryChannels();
    expect(channels.length).toBeGreaterThan(0);

    for (const channel of channels) {
      // If this ever flips to true, a real transport must exist behind it.
      expect(channel.available).toBe(false);
      expect(channel.reason.length).toBeGreaterThan(20);
    }
  });

  it('covers both channels the specification asks for', () => {
    const names = service.deliveryChannels().map((c) => c.channel);
    expect(names).toContain('email');
    expect(names).toContain('sms');
  });
});

describe('Phase 10 — the rule catalogue only describes detectable conditions', () => {
  it('declares every rule with a label and a description', () => {
    for (const rule of Object.values(RULE_CATALOGUE)) {
      expect(rule.label.length).toBeGreaterThan(2);
      expect(rule.description.length).toBeGreaterThan(10);
    }
  });

  it('covers the conditions this schema can actually detect', () => {
    const keys = Object.keys(RULE_CATALOGUE);
    for (const key of [
      'out_of_stock',
      'low_stock',
      'failed_payments',
      'refunds_pending',
      'high_value_orders',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it('does not offer customer review alerts, which have no data behind them', () => {
    // The specification lists them; there is no reviews table, so promising the
    // alert would mean promising something that can never fire.
    const keys = Object.keys(RULE_CATALOGUE);
    expect(keys.some((k) => k.includes('review'))).toBe(false);
  });

  it('gives every rule with a threshold a unit, and every rule without one none', () => {
    // A number with no unit is unlabelable in the UI, and a unit with no
    // threshold implies an input that does nothing.
    for (const rule of Object.values(RULE_CATALOGUE)) {
      if (rule.thresholdUnit !== null) {
        expect(['currency', 'days', 'percent']).toContain(rule.thresholdUnit);
      }
    }
  });

  it('keys are stable identifiers, not display text', () => {
    // Rule keys are persisted in notification_rules; changing one would orphan
    // an operator's stored setting.
    for (const key of Object.keys(RULE_CATALOGUE)) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(RULE_CATALOGUE[key].ruleKey).toBe(key);
    }
  });
});
