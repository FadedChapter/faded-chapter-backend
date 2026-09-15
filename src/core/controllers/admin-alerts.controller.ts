/**
 * Admin Alerts Controller
 *
 * Phase 10: Notifications.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission).
 */

import { Request, Response } from 'express';
import { AlertsService, RULE_CATALOGUE } from '../services/alerts.service';
import { logError, logInfo } from '../logging/logger';

export class AdminAlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** GET /alerts — live alerts, the rules behind them, and delivery status. */
  async overview(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const [alerts, rules] = await Promise.all([
        this.alerts.computeAlerts(storeId),
        this.alerts.listRules(storeId),
      ]);

      res.status(200).json({
        success: true,
        data: {
          alerts,
          rules,
          // Stated rather than implied: the console is currently the only
          // delivery surface, and the UI says so instead of offering channel
          // toggles that would do nothing.
          channels: this.alerts.deliveryChannels(),
        },
      });
    } catch (error) {
      logError('admin_alerts_overview_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load alerts' });
    }
  }

  /**
   * PATCH /alerts/rules/:ruleKey
   * Body: { enabled: boolean, threshold?: number | null }
   */
  async updateRule(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, ruleKey } = req.params;
      const catalogue = RULE_CATALOGUE[ruleKey];

      if (!catalogue) {
        res.status(404).json({
          success: false,
          error: `Unknown rule. Known rules: ${Object.keys(RULE_CATALOGUE).join(', ')}`,
        });
        return;
      }

      const enabled = req.body?.enabled;
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ success: false, error: 'enabled must be true or false' });
        return;
      }

      let threshold: number | null = null;
      if (catalogue.thresholdUnit !== null) {
        const raw = req.body?.threshold;
        threshold = raw === null || raw === undefined ? null : Number(raw);

        if (threshold !== null) {
          if (!Number.isFinite(threshold) || threshold < 0) {
            res.status(400).json({
              success: false,
              error: 'threshold must be zero or greater',
            });
            return;
          }
          // A percentage rule above 100 can never fire, which looks like the
          // rule is broken rather than mis-set.
          if (catalogue.thresholdUnit === 'percent' && threshold > 100) {
            res.status(400).json({
              success: false,
              error: 'A percentage threshold cannot exceed 100',
            });
            return;
          }
          if (catalogue.thresholdUnit === 'days' && !Number.isInteger(threshold)) {
            res.status(400).json({
              success: false,
              error: 'A look-back window must be a whole number of days',
            });
            return;
          }
        }
      }

      const updated = await this.alerts.setRule(storeId, ruleKey, enabled, threshold);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Unknown rule' });
        return;
      }

      // Published for the audit middleware: this route is keyed by rule_key,
      // not a uuid, so without the row id a rule change would leave no audit
      // record — including someone silencing an alert the team relies on.
      res.locals['auditRecordId'] = updated.rowId;

      logInfo('alert_rule_changed', {
        ruleKey,
        enabled,
        threshold,
        storeId,
        actorId: req.auth?.userId ?? null,
        actorEmail: req.auth?.email ?? null,
      });

      res.status(200).json({ success: true, data: updated.rule });
    } catch (error) {
      logError('admin_alerts_rule_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to update rule' });
    }
  }
}
