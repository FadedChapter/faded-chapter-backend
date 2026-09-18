# Phase 9c: Razorpay Webhook Handler - IMPLEMENTATION GUIDE

## Summary
Phase 9c implements complete Razorpay webhook handling with synchronous processing. The webhook system validates signatures, processes payment/refund events, and updates database records in real-time.

## Architecture

### Webhook Flow
```
Razorpay
    ↓
POST /api/v1/stores/:storeId/webhooks/razorpay
    ↓
WebhookController.handleRazorpayWebhook()
    ├─ Validate X-Razorpay-Signature header
    ├─ Verify HMAC-SHA256 signature
    └─ Parse JSON body
    ↓
WebhookHandlerService.handleWebhook()
    ├─ Route to event handler
    ├─ Find payment/refund entity
    ├─ Update status based on event
    └─ Save to database
    ↓
200 OK Response with event status
```

### Supported Events

#### Payment Events
| Event | Status Change | Payload Data |
|-------|--------------|--------------|
| `payment.authorized` | pending → authorized | Card details, risk data |
| `payment.captured` | authorized → captured | Amount, fees |
| `payment.failed` | any → failed | Error code, reason |

#### Refund Events
| Event | Status Change | Payload Data |
|-------|--------------|--------------|
| `refund.created` | (acknowledged) | Refund ID created |
| `refund.processed` | any → succeeded | Refund processed |
| `refund.failed` | any → failed | Failure reason |

#### Dispute Events (Future)
| Event | Status Change | Notes |
|-------|--------------|-------|
| `dispute.created` | (logged only) | Chargeback/dispute created |

## Implementation Details

### Files Created (Phase 9c)

#### 1. `webhook-handler.service.ts` ✅
**Responsibilities**: Event processing and database updates

**Methods**:
- `handleWebhook()` - Main entry point (routes by event type)
- `handlePaymentAuthorized()` - payment.authorized handler
- `handlePaymentFailed()` - payment.failed handler
- `handlePaymentCaptured()` - payment.captured handler
- `handleRefundCreated()` - refund.created handler
- `handleRefundProcessed()` - refund.processed handler
- `handleRefundFailed()` - refund.failed handler
- `handleDisputeCreated()` - dispute.created handler (logs only)

**Key Features**:
- Synchronous processing (no queues, direct database updates)
- Event-based routing
- Error handling for missing entities
- Metadata tracking (timestamp of webhook processing)
- Detailed response reporting

#### 2. `webhook.controller.ts` ✅
**Responsibilities**: HTTP request handling and signature validation

**Endpoints**:
- `POST /webhooks/razorpay` - Production webhook (signature validation required)
- `POST /webhooks/razorpay/test` - Development webhook (no validation)
- `GET /webhooks/health` - Health check

**Key Features**:
- HMAC-SHA256 signature validation
- Header validation (X-Razorpay-Signature)
- JSON parsing and error handling
- Synchronous request/response flow
- Development test endpoint

#### 3. `webhook.routes.ts` ✅
**Route Registration**: All routes at `/api/v1/stores/:storeId/webhooks`

#### 4. Repository Enhancement ✅
**Added to RefundRepository**:
- `findByRazorpayRefundId()` - Find refund by Razorpay refund ID

### Files Modified (Phase 9c)

1. **routes/index.ts**
   - Imported createWebhookRoutes
   - Updated registerCoreRoutes() signature
   - Added webhook route mounting

2. **app.ts**
   - Imported WebhookHandlerService
   - Instantiated webhook and razorpay services
   - Passed services to registerCoreRoutes()

## Configuration

### Environment Variables (Required)
```bash
# Razorpay API credentials
RAZORPAY_KEY_ID=rzp_xxx_xxx_xxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxx

# Webhook signature secret (from Razorpay dashboard)
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Razorpay Dashboard Setup

1. **Get Webhook Secret**:
   - Go to Razorpay Dashboard → Settings → Webhooks
   - Create webhook for: `https://yourdomain.com/api/v1/stores/{storeId}/webhooks/razorpay`
   - Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`

2. **Event Subscriptions**:
   - ✅ payment.authorized
   - ✅ payment.failed
   - ✅ payment.captured
   - ✅ refund.created
   - ✅ refund.processed
   - ✅ refund.failed
   - ⚠️ dispute.created (logged only, no processing)

3. **Retry Policy**:
   - Razorpay retries failed webhooks for 24 hours
   - Webhook handler should be idempotent (by Razorpay ID)

## API Usage

### Production Webhook Endpoint
```bash
POST /api/v1/stores/:storeId/webhooks/razorpay
Content-Type: application/json
X-Razorpay-Signature: <hmac-sha256-signature>

{
  "event": "payment.captured",
  "created_at": 1234567890,
  "payload": {
    "payment": {
      "id": "pay_xxxxx",
      "order_id": "order_xxxxx",
      "amount": 50000,
      "currency": "INR",
      "status": "captured",
      "method": "card",
      "card": {
        "id": "card_xxxxx",
        "entity": "card",
        "name": "John Doe",
        "last4": "4242",
        "network": "Visa",
        "type": "credit",
        "issuer": null,
        "international": false,
        "emi": false,
        "sub_type": "consumer"
      },
      "email": "customer@example.com",
      "contact": "+919876543210",
      "created_at": 1234567890
    }
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "event": "payment.captured",
  "message": "Payment captured successfully",
  "payment_id": "pay_uuid_xxxxx"
}
```

### Development Test Endpoint
```bash
POST /api/v1/stores/:storeId/webhooks/razorpay/test
Content-Type: application/json
# No signature header required

{
  "event": "payment.captured",
  "payload": { ... }
}
```

### Health Check
```bash
GET /api/v1/stores/:storeId/webhooks/health

Response:
{
  "success": true,
  "service": "webhook-handler",
  "status": "operational",
  "timestamp": "2024-09-14T12:34:56.789Z"
}
```

## Testing

### Unit Testing Strategy (Phase 9e)
```typescript
describe('WebhookHandlerService', () => {
  // Test payment.authorized
  // Test payment.captured
  // Test payment.failed
  // Test refund.created
  // Test refund.processed
  // Test refund.failed
  
  // Test missing payment/refund handling
  // Test metadata updates
  // Test error scenarios
});

describe('WebhookController', () => {
  // Test signature validation (valid)
  // Test signature validation (invalid)
  // Test missing signature header
  // Test webhook test endpoint (no signature)
  // Test health check
});
```

### Manual Testing with cURL

#### Test Payment Captured Event
```bash
curl -X POST http://localhost:3000/api/v1/stores/store-uuid/webhooks/razorpay/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.captured",
    "created_at": 1726350000,
    "payload": {
      "payment": {
        "id": "pay_test_12345",
        "order_id": "order_uuid",
        "amount": 50000,
        "currency": "INR",
        "status": "captured",
        "method": "card",
        "email": "test@example.com",
        "contact": "+919876543210",
        "created_at": 1726350000
      }
    }
  }'
```

#### Test Refund Processed Event
```bash
curl -X POST http://localhost:3000/api/v1/stores/store-uuid/webhooks/razorpay/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "refund.processed",
    "created_at": 1726350000,
    "payload": {
      "refund": {
        "id": "rfnd_test_67890",
        "entity": "refund",
        "payment_id": "pay_test_12345",
        "amount": 50000,
        "currency": "INR",
        "status": "processed",
        "created_at": 1726350000
      }
    }
  }'
```

### Integration Testing Strategy
1. Create payment intent
2. Confirm payment
3. Trigger payment.captured webhook (test endpoint)
4. Verify payment status updated in database
5. Request refund
6. Approve refund
7. Trigger refund.processed webhook (test endpoint)
8. Verify refund status updated to succeeded

## Idempotency & Safety

### Why Idempotent?
Razorpay retries failed webhooks. The same webhook can arrive multiple times.

### Idempotency Guarantees
1. **Finding by Razorpay ID**: Queries use `razorpay_payment_id` and `razorpay_refund_id`
2. **Status Idempotency**: Setting status to same value is safe
3. **Metadata Tracking**: Each update adds webhook timestamp
4. **No Duplicate Side Effects**: No emails or notifications triggered

### Example Idempotent Flow
```
Webhook 1 (payment.captured):
  ├─ Find payment by razorpay_payment_id ✓
  ├─ Set status = captured ✓
  └─ Save

Webhook 1 Retry (same event):
  ├─ Find payment by razorpay_payment_id ✓ (same entity)
  ├─ Set status = captured ✓ (same value)
  └─ Save (no side effects)
```

## Error Handling

### Webhook Response Codes
| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | No retry needed |
| 400 | Bad request (missing signature) | Fix webhook configuration |
| 401 | Invalid signature | Check RAZORPAY_WEBHOOK_SECRET |
| 404 | Payment/refund not found | Log only (might be external) |
| 500 | Server error | Razorpay will retry |

### Common Scenarios

#### Payment Not Found
```json
{
  "success": false,
  "event": "payment.captured",
  "message": "Payment pay_xxxxx not found for store store-uuid"
}
```
**Action**: Check if store_id matches Razorpay webhook configuration

#### Invalid Signature
```json
{
  "success": false,
  "error": "Invalid webhook signature"
}
```
**Action**: Verify RAZORPAY_WEBHOOK_SECRET in environment

#### Missing Signature Header
```json
{
  "success": false,
  "error": "Missing X-Razorpay-Signature header"
}
```
**Action**: Check Razorpay webhook request format

## Monitoring & Logging

### Suggested Logging
```typescript
// On webhook receipt
console.log(`[Webhook] Received ${event} for store ${storeId}`);

// On successful processing
console.log(`[Webhook] ${event} processed: ${payment_id || refund_id}`);

// On error
console.error(`[Webhook Error] ${event}: ${error_message}`);
```

### Metrics to Track
- Webhook receipt rate (events/min)
- Processing latency (ms)
- Error rate (% failed)
- Event type distribution
- Payment/refund status transition rates

## Security Considerations

### Signature Validation ✅
- HMAC-SHA256 with webhook secret
- Header-based signature: `X-Razorpay-Signature`
- Timing attack safe (constant-time comparison)

### Store Isolation ✅
- storeId in URL path
- All queries filtered by store_id
- No cross-store leaks

### Idempotency ✅
- Query by Razorpay ID (unique)
- Safe to retry indefinitely
- No duplicate side effects

### Future Enhancements
- Rate limiting on webhook endpoint
- Webhook replay attack prevention
- Webhook log retention policy
- Audit trail for status changes

## Status Transition Diagrams

### Payment Status Flow
```
pending
   ↓ (payment.authorized)
authorized
   ├─→ (payment.captured) → captured
   └─→ (payment.failed) → failed
```

### Refund Status Flow
```
pending_approval
   ├─→ (admin approve) → approved
   │     ↓ (refund.created)
   │     ↓ (refund.processed) → succeeded
   │     ↓ (refund.failed) → failed
   │
   └─→ (admin reject) → rejected
```

## Next Steps

### Phase 9d: Authorization & Security
- Add role-based access control (RBAC)
- Require admin role for payment/refund operations
- Add audit logging for all state changes
- Implement rate limiting

### Phase 9e: Integration Tests
- Test all webhook events
- Test signature validation
- Test idempotency
- Test error scenarios
- Test store isolation

### Phase 9f: Documentation & API Reference
- Swagger/OpenAPI spec
- Webhook event reference
- Error code reference
- Admin dashboard implementation

## Quick Reference

### Environment Setup
```bash
export RAZORPAY_KEY_ID="rzp_live_xxxxx"
export RAZORPAY_KEY_SECRET="xxxxxxxx"
export RAZORPAY_WEBHOOK_SECRET="whsec_xxxxx"
```

### Test Webhook
```bash
npm run dev  # Start dev server

# In another terminal
curl -X POST http://localhost:3000/api/v1/stores/store-id/webhooks/razorpay/test \
  -H "Content-Type: application/json" \
  -d '{ "event": "payment.captured", "payload": { "payment": { "id": "pay_test" } } }'
```

### Check Health
```bash
curl http://localhost:3000/api/v1/stores/store-id/webhooks/health
```

---

**Phase 9c Status**: COMPLETE
**Ready for**: Phase 9d (Authorization & Security) or Phase 9e (Integration Tests)
**Webhook Events Supported**: 6 (payment.authorized, payment.failed, payment.captured, refund.created, refund.processed, refund.failed)
**Synchronous Processing**: ✅ Yes (no queues, direct updates)
