# Monitoring & Observability

Comprehensive monitoring stack for Faded Chapter backend with Prometheus, Grafana, Alertmanager, and Sentry.

## Quick Start

### Local Monitoring Stack

```bash
# Start all monitoring services (Prometheus, Grafana, Alertmanager, PostgreSQL)
docker-compose -f docker-compose.monitoring.yml up -d

# View services
docker-compose -f docker-compose.monitoring.yml ps

# Stop all services
docker-compose -f docker-compose.monitoring.yml down
```

### Access Monitoring Dashboards

- **Grafana**: http://localhost:3001 (default: admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Node Exporter**: http://localhost:9100/metrics
- **PostgreSQL Exporter**: http://localhost:9187/metrics

## Components

### 1. **Prometheus** (Metrics Collection)
- Scrapes metrics from:
  - Backend API (`/metrics` endpoint)
  - Node Exporter (system metrics)
  - PostgreSQL Exporter (database metrics)
- Retention: 7 days
- Scrape interval: 15s

### 2. **Grafana** (Visualization)
- Pre-configured dashboards:
  - API Performance
  - Database Performance
  - System Metrics
  - Business Metrics
- Alerting integration with Alertmanager
- Automatic datasource provisioning

### 3. **Alertmanager** (Alert Management)
- Routes alerts by severity:
  - **Critical** → #critical-alerts (1h repeat)
  - **Warning** → #alerts (4h repeat)
  - **Info** → #alerts (no repeat)
- Alert suppression rules
- Slack integration (requires `SLACK_WEBHOOK_URL`)

### 4. **Node Exporter** (System Metrics)
- CPU, memory, disk usage
- Network metrics
- Uptime monitoring

### 5. **PostgreSQL Exporter** (Database Metrics)
- Query performance
- Connection pool
- Table/index statistics
- Replication status (if applicable)

## Backend Integration

### Health Check Endpoints

```bash
# Liveness probe (is app alive?)
curl http://localhost:3000/health/live

# Readiness probe (is app ready?)
curl http://localhost:3000/health/ready

# Detailed health diagnostics
curl http://localhost:3000/health/detailed

# Startup probe (is app starting?)
curl http://localhost:3000/health/startup
```

### Metrics Endpoint

```bash
# Prometheus metrics format
curl http://localhost:3000/metrics

# Health-only metrics
curl http://localhost:3000/metrics/health
```

## Metrics Collected

### HTTP Metrics
- `http_requests_total` - Total requests by method/route/status
- `http_request_duration_seconds` - Request latency (with percentiles)

### Database Metrics
- `db_query_duration_seconds` - Query latency
- `db_connection_pool_size` - Connection pool size
- `db_connection_pool_active` - Active connections

### Business Metrics
- `orders_created_total` - Orders created
- `orders_total_value` - Order revenue
- `payments_processed_total` - Payment transactions
- `customers_registered_total` - New customers
- `audit_logs_created_total` - Audit trail

### Error Metrics
- `errors_total` - Errors by type
- `authentication_failures_total` - Auth failures
- `rate_limit_exceeded_total` - Rate limit violations

### Application Metrics
- `app_uptime_seconds` - Application uptime
- `app_startup_total` - Restart count

## Alert Rules

Critical alerts (< 1 minute response):
- High error rate (> 5%)
- Database connection failures
- Payment processing failures
- API latency (p95 > 2s)

Warning alerts (5+ minute response):
- Slow database queries
- High memory usage (> 85%)
- High authentication failures
- Frequent rate limiting

## Sentry Configuration

### Enable Error Tracking

```bash
# Set Sentry DSN
export SENTRY_DSN="https://<key>@sentry.io/<project>"

# Start backend
npm run dev
```

All unhandled errors and exceptions will be sent to Sentry.

### Sentry Features
- Real-time error tracking
- Source map support
- Release tracking
- Performance monitoring
- User feedback

## Kubernetes Deployment

### Health Probes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10

startupProbe:
  httpGet:
    path: /health/startup
    port: 3000
  failureThreshold: 30
  periodSeconds: 10
```

### Prometheus Scrape Configuration

```yaml
serviceMonitor:
  enabled: true
  interval: 15s
  path: /metrics
```

## Dashboard Navigation

### API Performance Dashboard
- Request rate and volume
- Latency percentiles (p50, p95, p99)
- Error rates by status code
- Top slow endpoints

### Database Dashboard
- Query latency trends
- Connection pool utilization
- Slow query detection
- Query count by operation

### Business Dashboard
- Orders created (daily/hourly)
- Revenue trends
- Payment success rate
- Customer signups

### System Dashboard
- CPU and memory usage
- Disk I/O
- Network throughput
- Node uptime

## Common Tasks

### View Real-Time Metrics

```bash
# Terminal 1: Start backend with metrics enabled
npm run dev

# Terminal 2: Query Prometheus
curl "http://localhost:9090/api/v1/query?query=http_requests_total"
```

### Create Custom Dashboard

1. Open Grafana (http://localhost:3001)
2. Click "+" → "Dashboard"
3. Add panels with PromQL queries
4. Save to `monitoring/grafana/dashboards/`

### Test Alerts

```bash
# Trigger high error rate
for i in {1..100}; do
  curl http://localhost:3000/invalid-endpoint
done

# Check Alertmanager
curl http://localhost:9093/api/v1/alerts
```

### Disable Alert Notifications Temporarily

In Alertmanager, comment out the `slack_configs` section in `alertmanager.yml`:

```yaml
receivers:
  - name: 'critical'
    # slack_configs:
    #   - channel: '#critical-alerts'
```

Then reload:
```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

## Troubleshooting

### Prometheus not scraping metrics

```bash
# Check scrape targets
curl http://localhost:9090/api/v1/targets

# Check Prometheus logs
docker-compose -f docker-compose.monitoring.yml logs prometheus
```

### Grafana datasource connection failed

```bash
# Verify Prometheus is running
docker-compose -f docker-compose.monitoring.yml ps

# Test connection
curl http://prometheus:9090/-/healthy
```

### Alerts not firing

1. Check alert rules syntax in `alert_rules.yml`
2. Verify metrics are being scraped
3. Check Prometheus evaluation: http://localhost:9090/alerts
4. Check Alertmanager routing rules

### Memory leak in Prometheus

- Reduce `storage.tsdb.retention.time` in prometheus.yml
- Increase scrape interval if too high volume
- Archive old metrics data

## Production Checklist

- [ ] Enable Sentry error tracking
- [ ] Configure Slack webhooks for alerts
- [ ] Set appropriate retention periods
- [ ] Scale Prometheus for high volume (use remote storage)
- [ ] Set up backups for Grafana dashboards
- [ ] Configure authentication for dashboards
- [ ] Set up log aggregation (ELK, Splunk, etc.)
- [ ] Configure SLOs based on metrics
- [ ] Set up on-call rotation based on alerts

## Resources

- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [Alertmanager Docs](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Sentry Docs](https://docs.sentry.io/)
