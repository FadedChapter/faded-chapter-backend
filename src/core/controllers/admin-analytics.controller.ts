/**
 * Admin Analytics Controller
 *
 * Phase 7: Reports & Analytics.
 *
 * Authorisation is applied by the admin router before any handler runs
 * (authenticate → role → store-ownership → permission).
 */

import { Request, Response } from 'express';
import { AnalyticsService, UNAVAILABLE_METRICS } from '../services/analytics.service';
import { logError, logInfo } from '../logging/logger';

function parseIntOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Escape a value for CSV.
 *
 * Two separate concerns, and the second is the one people miss.
 *
 * Quoting: any field containing a delimiter, quote or newline is wrapped and
 * its quotes doubled, per RFC 4180.
 *
 * Formula injection: a spreadsheet treats a leading =, +, - or @ as a formula,
 * so a product name of `=HYPERLINK(...)` becomes executable when the export is
 * opened. Product names and refund reasons in this system are operator- and
 * customer-supplied, which makes an export a delivery mechanism. Such values
 * are prefixed with a single quote so the sheet renders them as text.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  // CRLF per RFC 4180; Excel is happier with it and everything else tolerates it.
  return lines.join('\r\n');
}

/** Reports the export endpoint can produce. */
const EXPORTS = ['revenue', 'products', 'categories'] as const;
type ExportName = (typeof EXPORTS)[number];

export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** GET /analytics — everything the overview needs, in one round trip. */
  async overview(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const days = parseIntOr(req.query['days'], 30);

      const [summary, revenue, topProducts, categories, customerMix] = await Promise.all([
        this.analytics.summary(storeId, days),
        this.analytics.revenueSeries(storeId, days),
        this.analytics.topProducts(storeId, days, 10),
        this.analytics.categoryPerformance(storeId, days),
        this.analytics.customerMix(storeId, days),
      ]);

      res.status(200).json({
        success: true,
        data: {
          days,
          summary,
          revenue,
          topProducts,
          categories,
          customerMix,
          // Returned so the console can state what is missing and why, instead
          // of leaving an operator to guess whether a figure is zero or absent.
          unavailable: UNAVAILABLE_METRICS,
        },
      });
    } catch (error) {
      logError('admin_analytics_overview_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to load analytics' });
    }
  }

  /**
   * GET /analytics/export?report=revenue&days=30
   * Returns text/csv as an attachment.
   */
  async exportCsv(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const days = parseIntOr(req.query['days'], 30);
      const report = String(req.query['report'] ?? 'revenue') as ExportName;

      if (!EXPORTS.includes(report)) {
        res.status(400).json({
          success: false,
          error: `report must be one of: ${EXPORTS.join(', ')}`,
        });
        return;
      }

      let csv: string;

      if (report === 'revenue') {
        const rows = await this.analytics.revenueSeries(storeId, days);
        csv = toCsv(
          ['Date', 'Revenue', 'Orders'],
          rows.map((r) => [r.date, r.revenue, r.orders]),
        );
      } else if (report === 'products') {
        const rows = await this.analytics.topProducts(storeId, days, 50);
        csv = toCsv(
          ['SKU', 'Product', 'Units', 'Revenue'],
          rows.map((r) => [r.sku, r.productName, r.units, r.revenue]),
        );
      } else {
        const rows = await this.analytics.categoryPerformance(storeId, days);
        csv = toCsv(
          ['Category', 'Units', 'Revenue', 'Share of revenue %'],
          rows.map((r) => [r.categoryName, r.units, r.revenue, r.shareOfRevenue]),
        );
      }

      // An export removes data from the audited console and puts it on a laptop,
      // so who exported what is worth recording even though nothing changed.
      logInfo('analytics_exported', {
        report,
        days,
        storeId,
        actorId: req.auth?.userId ?? null,
        actorEmail: req.auth?.email ?? null,
      });

      const filename = `faded-chapter-${report}-${days}d.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // A CSV is not a script; make sure nothing tries to render it as one.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(200).send(csv);
    } catch (error) {
      logError('admin_analytics_export_failed', error as Error, { path: req.path });
      res.status(500).json({ success: false, error: 'Failed to export report' });
    }
  }
}
