/**
 * Analytics Service
 *
 * Phase 7: Reports & Analytics.
 *
 * Deliberately a service rather than a repository method: every query here
 * spans several tables and belongs to no single entity.
 *
 * WHAT THIS DOES NOT COMPUTE, AND WHY
 * The specification lists conversion rate, cart abandonment, traffic sources
 * and customer acquisition cost. None are computable from this schema — there
 * are no session, cart or marketing-spend tables — so none are produced.
 * A plausible-looking number derived from unrelated data is worse than a gap,
 * because it gets planned against. UNAVAILABLE_METRICS below is returned to the
 * client so the console can say what is missing and why, rather than leaving an
 * operator to wonder whether the figure is zero or absent.
 *
 * Revenue excludes cancelled orders throughout, matching the lifetime-value
 * rule in the customers module, so the two consoles cannot disagree.
 */

import { getDataSource } from '../database/postgres-data-source';

/** Metrics the specification asks for that this schema cannot support. */
export const UNAVAILABLE_METRICS: ReadonlyArray<{
  metric: string;
  reason: string;
  needs: string;
}> = [
  {
    metric: 'Conversion rate',
    reason: 'Sessions and visits are not recorded, so there is no denominator.',
    needs: 'a sessions table',
  },
  {
    metric: 'Cart abandonment',
    reason: 'Carts are not persisted, so an abandoned cart leaves no trace.',
    needs: 'a carts table',
  },
  {
    metric: 'Traffic sources',
    reason: 'Referrer and campaign attribution are not captured at any point.',
    needs: 'session attribution',
  },
  {
    metric: 'Customer acquisition cost',
    reason: 'Marketing spend is not recorded anywhere in this system.',
    needs: 'a marketing spend source',
  },
];

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  units: number;
  revenue: number;
}

export interface CategoryPerformance {
  categoryId: string | null;
  categoryName: string;
  units: number;
  revenue: number;
  shareOfRevenue: number;
}

export interface CustomerMix {
  newCustomers: number;
  returningCustomers: number;
  ordersFromNew: number;
  ordersFromReturning: number;
}

export interface AnalyticsSummary {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  unitsSold: number;
  refundedValue: number;
  refundRate: number;
  paymentSuccessRate: number;
}

/** Clamp the window so a caller cannot ask for an unbounded scan. */
function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 30;
  return Math.min(Math.max(Math.trunc(days), 1), 365);
}

export class AnalyticsService {
  private get manager() {
    return getDataSource().manager;
  }

  /**
   * Daily revenue and order count.
   *
   * Uses generate_series so days with no orders appear as zero rather than
   * being absent. A chart that silently skips empty days compresses the x-axis
   * and makes a quiet week look like a busy one.
   */
  async revenueSeries(storeId: string, days: number): Promise<RevenuePoint[]> {
    const window = clampDays(days);

    const rows = await this.manager.query(
      `
      WITH span AS (
        SELECT generate_series(
          (CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day')::date,
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        span.day::text                              AS date,
        COALESCE(SUM(o.total), 0)::float            AS revenue,
        COUNT(o.id)::int                            AS orders
      FROM span
      LEFT JOIN orders o
        ON o.created_at::date = span.day
       AND o.store_id = $1
       AND o.status <> 'cancelled'
      GROUP BY span.day
      ORDER BY span.day ASC
      `,
      [storeId, window],
    );

    return rows.map((r: { date: string; revenue: number; orders: number }) => ({
      date: r.date,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    }));
  }

  /**
   * Best sellers by revenue, with units alongside.
   *
   * Name and SKU come from `products`, NOT from the denormalised copies on
   * order_lines. Those copies are deliberately frozen at purchase time so an
   * order always shows what was actually bought even if the product is later
   * renamed — correct for order history, wrong here. Analytics groups by
   * product, so it must use the product's current identity, and a stale line
   * copy otherwise attributes one product's sales to another's name.
   *
   * Aggregating by product also means a single line SKU would be arbitrary
   * where a product has several variants, so the product's own SKU is used.
   */
  async topProducts(storeId: string, days: number, limit = 10): Promise<TopProduct[]> {
    const window = clampDays(days);
    const capped = Math.min(Math.max(Math.trunc(limit) || 10, 1), 50);

    const rows = await this.manager.query(
      `
      SELECT
        p.id                                        AS "productId",
        p.name                                      AS "productName",
        p.sku                                       AS sku,
        SUM(l.quantity)::int                        AS units,
        SUM(l.line_total)::float                    AS revenue
      FROM order_lines l
      JOIN orders o   ON o.id = l.order_id AND o.store_id = l.store_id
      JOIN products p ON p.id = l.product_id
      WHERE l.store_id = $1
        AND o.status <> 'cancelled'
        AND o.created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
      GROUP BY p.id, p.name, p.sku
      ORDER BY revenue DESC
      LIMIT $3
      `,
      [storeId, window, capped],
    );

    return rows.map((r: TopProduct) => ({
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      units: Number(r.units),
      revenue: Number(r.revenue),
    }));
  }

  /**
   * Revenue by category.
   *
   * Joins through variant to product to category. Lines whose product no longer
   * resolves to a category are grouped as Uncategorised rather than dropped —
   * silently discarding revenue would make the shares fail to sum to the total.
   */
  async categoryPerformance(storeId: string, days: number): Promise<CategoryPerformance[]> {
    const window = clampDays(days);

    const rows = await this.manager.query(
      `
      SELECT
        c.id                                        AS "categoryId",
        COALESCE(c.name, 'Uncategorised')           AS "categoryName",
        SUM(l.quantity)::int                        AS units,
        SUM(l.line_total)::float                    AS revenue
      FROM order_lines l
      JOIN orders o           ON o.id = l.order_id AND o.store_id = l.store_id
      LEFT JOIN products p    ON p.id = l.product_id
      LEFT JOIN categories c  ON c.id = p.category_id
      WHERE l.store_id = $1
        AND o.status <> 'cancelled'
        AND o.created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
      `,
      [storeId, window],
    );

    const total = rows.reduce(
      (sum: number, r: { revenue: number }) => sum + Number(r.revenue),
      0,
    );

    return rows.map((r: CategoryPerformance) => ({
      categoryId: r.categoryId ?? null,
      categoryName: r.categoryName,
      units: Number(r.units),
      revenue: Number(r.revenue),
      // Share is computed server-side so every client renders the same split.
      shareOfRevenue: total > 0 ? Number(((Number(r.revenue) / total) * 100).toFixed(1)) : 0,
    }));
  }

  /**
   * New versus returning customers in the window.
   *
   * "New" means their first ever order falls inside the window, not merely that
   * they ordered during it — otherwise a long-standing customer would be
   * counted as new every time the window moved.
   */
  async customerMix(storeId: string, days: number): Promise<CustomerMix> {
    const window = clampDays(days);

    const rows = await this.manager.query(
      `
      WITH first_order AS (
        SELECT customer_id, MIN(created_at) AS first_at
        FROM orders
        WHERE store_id = $1 AND status <> 'cancelled'
        GROUP BY customer_id
      ),
      in_window AS (
        SELECT o.customer_id, COUNT(*)::int AS orders
        FROM orders o
        WHERE o.store_id = $1
          AND o.status <> 'cancelled'
          AND o.created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
        GROUP BY o.customer_id
      )
      SELECT
        COUNT(*) FILTER (WHERE f.first_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day')::int AS "newCustomers",
        COUNT(*) FILTER (WHERE f.first_at <  CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day')::int AS "returningCustomers",
        COALESCE(SUM(w.orders) FILTER (WHERE f.first_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'), 0)::int AS "ordersFromNew",
        COALESCE(SUM(w.orders) FILTER (WHERE f.first_at <  CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'), 0)::int AS "ordersFromReturning"
      FROM in_window w
      JOIN first_order f ON f.customer_id = w.customer_id
      `,
      [storeId, window],
    );

    const r = rows[0] ?? {};
    return {
      newCustomers: Number(r.newCustomers ?? 0),
      returningCustomers: Number(r.returningCustomers ?? 0),
      ordersFromNew: Number(r.ordersFromNew ?? 0),
      ordersFromReturning: Number(r.ordersFromReturning ?? 0),
    };
  }

  /** Headline figures for the window. */
  async summary(storeId: string, days: number): Promise<AnalyticsSummary> {
    const window = clampDays(days);

    const [orderRow] = await this.manager.query(
      `
      SELECT
        COALESCE(SUM(o.total), 0)::float AS revenue,
        COUNT(o.id)::int                 AS orders
      FROM orders o
      WHERE o.store_id = $1
        AND o.status <> 'cancelled'
        AND o.created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
      `,
      [storeId, window],
    );

    const [unitRow] = await this.manager.query(
      `
      SELECT COALESCE(SUM(l.quantity), 0)::int AS units
      FROM order_lines l
      JOIN orders o ON o.id = l.order_id AND o.store_id = l.store_id
      WHERE l.store_id = $1
        AND o.status <> 'cancelled'
        AND o.created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
      `,
      [storeId, window],
    );

    // Refund value comes from approved refunds — the same source the payments
    // console uses, so the two cannot disagree about money going out.
    const [refundRow] = await this.manager.query(
      `
      SELECT COALESCE(SUM(r.amount), 0)::float AS refunded
      FROM refunds r
      WHERE r.store_id = $1
        AND r.status = 'approved'
        AND r.created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
      `,
      [storeId, window],
    );

    const [paymentRow] = await this.manager.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('captured','refunded'))::int AS succeeded,
        COUNT(*)::int                                                  AS attempted
      FROM payments
      WHERE store_id = $1
        AND created_at >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
      `,
      [storeId, window],
    );

    const revenue = Number(orderRow?.revenue ?? 0);
    const orders = Number(orderRow?.orders ?? 0);
    const refundedValue = Number(refundRow?.refunded ?? 0);
    const attempted = Number(paymentRow?.attempted ?? 0);
    const succeeded = Number(paymentRow?.succeeded ?? 0);

    return {
      revenue,
      orders,
      // Guarded: an empty window would otherwise divide by zero and report NaN,
      // which serialises to null and reads as "unknown" rather than zero.
      averageOrderValue: orders > 0 ? Math.round(revenue / orders) : 0,
      unitsSold: Number(unitRow?.units ?? 0),
      refundedValue,
      refundRate: revenue > 0 ? Number(((refundedValue / revenue) * 100).toFixed(1)) : 0,
      paymentSuccessRate:
        attempted > 0 ? Number(((succeeded / attempted) * 100).toFixed(1)) : 0,
    };
  }
}
