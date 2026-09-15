/**
 * Alerts Service
 *
 * Phase 10: Notifications.
 *
 * WHAT THIS IS, AND WHY IT IS NOT A NOTIFICATION SENDER
 *
 * The specification asks for order notifications, low-stock alerts, payment
 * failure alerts, high-value order alerts and email/SMS delivery.
 *
 * There is no delivery transport in this system. EmailSenderService is a stub
 * whose send path is a TODO, and no SMS provider exists at all. Building a
 * notification-preferences UI on top of that would produce switches that appear
 * to arm alerts and silently do nothing — worse than no feature, because an
 * operator would stop watching for the conditions themselves.
 *
 * So alerts are computed on read from data that already exists, and the console
 * is the delivery surface. Every alert below corresponds to a condition true in
 * the database right now; none are stored, queued or invented. When a transport
 * is added, these same rules become its triggers without changing.
 *
 * Customer reviews are omitted entirely: there is no reviews table.
 */

import { getDataSource } from '../database/postgres-data-source';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  ruleKey: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  count: number;
  /** Where in the console to act on it. */
  href: string;
}

export interface NotificationRule {
  ruleKey: string;
  enabled: boolean;
  threshold: number | null;
  /** What the threshold means, so the console can label its input. */
  thresholdUnit: 'currency' | 'days' | 'percent' | null;
  label: string;
  description: string;
}

/**
 * Rule catalogue.
 *
 * Declared here rather than in the database so the set of conditions the system
 * understands is reviewable in one place; the database stores only whether each
 * is enabled and at what threshold.
 */
const RULE_CATALOGUE: Record<
  string,
  Omit<NotificationRule, 'enabled' | 'threshold'>
> = {
  out_of_stock: {
    ruleKey: 'out_of_stock',
    thresholdUnit: null,
    label: 'Out of stock',
    description: 'A variant has nothing sellable left.',
  },
  low_stock: {
    ruleKey: 'low_stock',
    thresholdUnit: null,
    label: 'Low stock',
    description: 'A variant is at or below its own reorder level.',
  },
  failed_payments: {
    ruleKey: 'failed_payments',
    thresholdUnit: 'days',
    label: 'Failed payments',
    description: 'Payments that failed within the look-back window.',
  },
  refunds_pending: {
    ruleKey: 'refunds_pending',
    thresholdUnit: null,
    label: 'Refunds awaiting a decision',
    description: 'Refund requests nobody has approved or rejected yet.',
  },
  high_value_orders: {
    ruleKey: 'high_value_orders',
    thresholdUnit: 'currency',
    label: 'High-value orders',
    description: 'Orders above the threshold, still awaiting fulfilment.',
  },
  discount_exhausting: {
    ruleKey: 'discount_exhausting',
    thresholdUnit: 'percent',
    label: 'Discount nearly exhausted',
    description: 'An active code has consumed most of its usage limit.',
  },
};

export class AlertsService {
  private get manager() {
    return getDataSource().manager;
  }

  /** Rules with their stored state, for the settings surface. */
  async listRules(storeId: string): Promise<NotificationRule[]> {
    const rows = await this.manager.query(
      `SELECT rule_key AS "ruleKey", enabled, threshold
       FROM notification_rules WHERE store_id = $1`,
      [storeId],
    );
    const stored = new Map(
      rows.map((r: { ruleKey: string; enabled: boolean; threshold: string | null }) => [
        r.ruleKey,
        r,
      ]),
    );

    return Object.values(RULE_CATALOGUE).map((rule) => {
      const row = stored.get(rule.ruleKey) as
        | { enabled: boolean; threshold: string | null }
        | undefined;
      return {
        ...rule,
        // A rule with no stored row is on by default: a condition the system
        // knows how to detect should not go unwatched because nobody has
        // visited the settings page yet.
        enabled: row ? Boolean(row.enabled) : true,
        threshold: row?.threshold === null || row?.threshold === undefined
          ? null
          : Number(row.threshold),
      };
    });
  }

  /**
   * Upsert a rule, returning it together with its persisted row id.
   *
   * The id is returned because the audit middleware records a uuid, and this
   * route is keyed by rule_key — a stable string, not a uuid — so without it
   * rule changes would be logged but never written to the audit table.
   */
  async setRule(
    storeId: string,
    ruleKey: string,
    enabled: boolean,
    threshold: number | null,
  ): Promise<{ rule: NotificationRule; rowId: string } | null> {
    if (!RULE_CATALOGUE[ruleKey]) {
      return null;
    }
    await this.manager.query(
      `INSERT INTO notification_rules (id, store_id, rule_key, enabled, threshold, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
       ON CONFLICT (store_id, rule_key)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                     threshold = EXCLUDED.threshold,
                     updated_at = now()`,
      [storeId, ruleKey, enabled, threshold],
    );
    const rules = await this.listRules(storeId);
    const rule = rules.find((r) => r.ruleKey === ruleKey);
    if (!rule) return null;

    const [row] = await this.manager.query(
      `SELECT id FROM notification_rules WHERE store_id = $1 AND rule_key = $2`,
      [storeId, ruleKey],
    );
    return { rule, rowId: row?.id ?? '' };
  }

  /**
   * Compute live alerts.
   *
   * Each query counts a condition rather than listing rows: the console shows
   * how many and links to the module that can act on them, and duplicating
   * those modules' lists here would mean two places to keep correct.
   */
  async computeAlerts(storeId: string): Promise<Alert[]> {
    const rules = await this.listRules(storeId);
    const enabled = new Map(rules.filter((r) => r.enabled).map((r) => [r.ruleKey, r]));
    const alerts: Alert[] = [];

    if (enabled.has('out_of_stock')) {
      const [row] = await this.manager.query(
        `SELECT COUNT(*)::int AS n FROM inventory
         WHERE store_id = $1 AND quantity_available <= 0`,
        [storeId],
      );
      if (row?.n > 0) {
        alerts.push({
          ruleKey: 'out_of_stock',
          severity: 'critical',
          title: 'Out of stock',
          detail: `${row.n} variant${row.n === 1 ? '' : 's'} cannot be sold`,
          count: row.n,
          href: '/admin/inventory',
        });
      }
    }

    if (enabled.has('low_stock')) {
      const [row] = await this.manager.query(
        `SELECT COUNT(*)::int AS n FROM inventory
         WHERE store_id = $1
           AND quantity_available > 0
           AND quantity_available <= reorder_level`,
        [storeId],
      );
      if (row?.n > 0) {
        alerts.push({
          ruleKey: 'low_stock',
          severity: 'warning',
          title: 'Low stock',
          detail: `${row.n} variant${row.n === 1 ? '' : 's'} at or below reorder level`,
          count: row.n,
          href: '/admin/inventory',
        });
      }
    }

    if (enabled.has('refunds_pending')) {
      const [row] = await this.manager.query(
        `SELECT COUNT(*)::int AS n FROM refunds
         WHERE store_id = $1 AND status = 'pending_approval'`,
        [storeId],
      );
      if (row?.n > 0) {
        alerts.push({
          ruleKey: 'refunds_pending',
          severity: 'warning',
          title: 'Refunds awaiting a decision',
          detail: `${row.n} refund${row.n === 1 ? '' : 's'} with money held pending approval`,
          count: row.n,
          href: '/admin/payments',
        });
      }
    }

    const failedRule = enabled.get('failed_payments');
    if (failedRule) {
      const days = failedRule.threshold ?? 7;
      const [row] = await this.manager.query(
        `SELECT COUNT(*)::int AS n FROM payments
         WHERE store_id = $1 AND status = 'failed'
           AND created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'`,
        [storeId, Math.max(1, Math.trunc(days))],
      );
      if (row?.n > 0) {
        alerts.push({
          ruleKey: 'failed_payments',
          severity: 'warning',
          title: 'Failed payments',
          detail: `${row.n} payment${row.n === 1 ? '' : 's'} failed in the last ${days} days`,
          count: row.n,
          href: '/admin/payments',
        });
      }
    }

    const highValue = enabled.get('high_value_orders');
    if (highValue) {
      const threshold = highValue.threshold ?? 0;
      const [row] = await this.manager.query(
        `SELECT COUNT(*)::int AS n FROM orders
         WHERE store_id = $1
           AND status IN ('pending','processing')
           AND total >= $2`,
        [storeId, threshold],
      );
      if (row?.n > 0) {
        alerts.push({
          ruleKey: 'high_value_orders',
          severity: 'info',
          title: 'High-value orders awaiting fulfilment',
          detail: `${row.n} order${row.n === 1 ? '' : 's'} at or above the threshold`,
          count: row.n,
          href: '/admin/orders',
        });
      }
    }

    const exhausting = enabled.get('discount_exhausting');
    if (exhausting) {
      const pct = exhausting.threshold ?? 90;
      const [row] = await this.manager.query(
        `SELECT COUNT(*)::int AS n FROM promo_codes
         WHERE store_id = $1
           AND status = 'active'
           AND usage_limit IS NOT NULL
           AND usage_limit > 0
           AND (usage_count::numeric / usage_limit::numeric) * 100 >= $2`,
        [storeId, pct],
      );
      if (row?.n > 0) {
        alerts.push({
          ruleKey: 'discount_exhausting',
          severity: 'info',
          title: 'Discount nearly exhausted',
          detail: `${row.n} active code${row.n === 1 ? '' : 's'} past ${pct}% of its limit`,
          count: row.n,
          href: '/admin/discounts',
        });
      }
    }

    // Most urgent first, so the console's order matches an operator's.
    const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }

  /**
   * Whether alerts can be delivered anywhere other than this console.
   *
   * Reported to the client so the UI can say so plainly rather than offering
   * channel toggles that would silently do nothing.
   */
  deliveryChannels(): Array<{ channel: string; available: boolean; reason: string }> {
    return [
      {
        channel: 'email',
        available: false,
        reason:
          'No mail transport is configured — the email sender is a stub with an unimplemented send path.',
      },
      {
        channel: 'sms',
        available: false,
        reason: 'No SMS provider is integrated.',
      },
    ];
  }
}

export { RULE_CATALOGUE };
