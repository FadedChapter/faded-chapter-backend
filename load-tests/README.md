# Load Testing Suite

Comprehensive load testing configuration using [Artillery](https://artillery.io/) for the Faded Chapter backend API.

## Overview

This suite tests three critical scenarios:
- **Dashboard**: Read-heavy operations (metrics, charts, admin actions)
- **Orders**: Mixed read/write operations (order creation, search, filtering)
- **Stress**: Incremental stress test to find breaking point

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Start the backend server
npm run dev

# In another terminal, run load tests
npm run load-test:dashboard
```

## Available Commands

```bash
# Run individual test suites
npm run load-test:dashboard    # Dashboard endpoints
npm run load-test:orders       # Order endpoints
npm run load-test:stress       # Stress test to breaking point

# Run all tests
npm run load-test:all

# Generate HTML report
npm run load-test:report
```

## Configuration

### Environment Variables

Set these before running tests:

```bash
export API_BASE_URL=http://localhost:3000/api/v1
export AUTH_TOKEN=your-jwt-token
```

Default: `http://localhost:3000/api/v1` (no authentication)

## Test Scenarios

### 1. Dashboard Load Test (`dashboard.yml`)

**Purpose**: Validate dashboard endpoint performance under normal load

**Phases**:
- Warmup: 1 req/sec for 30s
- Sustained: 10 req/sec for 120s
- Ramp down: 2 req/sec for 30s

**Endpoints tested**:
- GET `/dashboard/metrics` - KPI metrics
- GET `/dashboard/admin-actions` - Audit log
- GET `/dashboard/refund-statistics` - Refund stats
- GET `/dashboard/charts/revenue` - Revenue chart
- GET `/dashboard/charts/refunds` - Refund chart
- GET `/dashboard/pending-refunds` - Refund list

**Expected performance**: < 1000ms response time

### 2. Orders Load Test (`orders.yml`)

**Purpose**: Test order creation and search under realistic traffic

**Phases**:
- Normal: 5 req/sec for 60s
- Peak: 15 req/sec for 120s
- Recovery: 2 req/sec for 60s

**Scenarios** (weighted):
- Order creation (30%): POST `/orders` + GET `/inventory`
- Order search (50%): GET `/orders` with various filters
- Order detail (20%): GET `/orders/{id}`

**Expected performance**: < 1500ms response time

### 3. Stress Test (`stress-test.yml`)

**Purpose**: Find API breaking point and recovery behavior

**Phases**:
- Baseline: 5 req/sec
- Increased: 15 req/sec
- High: 25 req/sec
- Stress: 40 req/sec
- Spike: 50 req/sec
- Recovery: 10 req/sec

**Metrics tracked**:
- Response times at each load level
- Error rate (429, 503 expected at spike)
- Recovery time after stress

## Results & Reports

### Console Output

Artillery prints real-time metrics:

```
  summary report @ 14:32:45
  ========================

  Successful requests : 1000
  Failed requests     : 5
  Median latency      : 145ms
  Max latency         : 2500ms
  Min latency         : 50ms
  p95 latency         : 850ms
  p99 latency         : 1200ms
  RPS sent            : 50
  RPS received        : 50
```

### HTML Reports

Generate detailed HTML reports:

```bash
npm run load-test:report
# Open results/load-test.html in browser
```

## Performance Baselines

Target metrics for production readiness:

| Scenario | Load | p95 Latency | p99 Latency | Error Rate |
|----------|------|-------------|-------------|-----------|
| Dashboard | 10 req/s | < 500ms | < 1000ms | < 1% |
| Orders | 15 req/s | < 800ms | < 1500ms | < 1% |
| Stress | 40 req/s | < 2000ms | < 3000ms | < 5% |

## CI/CD Integration

Load tests run automatically:
- **Weekly**: Monday 2 AM UTC (automated)
- **On demand**: Via workflow dispatch with test type selection

View results: GitHub Actions → Load Testing → Artifacts

## Troubleshooting

### Server connection refused

```bash
# Ensure backend is running
npm run dev

# Verify API URL
curl http://localhost:3000/api/v1/health
```

### High error rate

```bash
# Check server logs
# May indicate database connection issues or rate limiting

# Verify database is running
# Check API rate limits in code
```

### Out of memory

```bash
# Reduce concurrent users in YAML config
# Lower arrivalRate values
# Increase Node.js heap size
NODE_OPTIONS=--max-old-space-size=4096 npm run load-test:orders
```

## Artillery Documentation

- [Official docs](https://artillery.io/docs)
- [Config reference](https://artillery.io/docs/guide/getting-started)
- [Advanced scenarios](https://artillery.io/docs/guide/advanced)

## Next Steps

1. Establish performance baselines locally
2. Run weekly automated tests
3. Track metrics over time
4. Identify bottlenecks from results
5. Optimize based on findings
