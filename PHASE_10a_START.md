# Phase 10a: Admin Dashboard - Getting Started

## Quick Reference for Next Session

### What to Build
Admin dashboard UI for refund management, payment monitoring, and audit logs.

### Prerequisites
- ✅ Phase 9 (9a-9e) complete
- ✅ Authorization middleware in place
- ✅ Audit logging working
- ✅ Database migrations applied

### Phase 10a Scope

#### Dashboard Components
1. **KPI Overview Card**
   - Total revenue (last 30 days)
   - Pending refunds (count + amount)
   - Successful payments (count + rate)
   - Failed payments (count + rate)

2. **Refund Management Table**
   - List pending refunds
   - Approve/Reject buttons
   - Filters (status, date, customer, amount)
   - Details panel with audit trail

3. **Audit Log Viewer**
   - Timeline of admin actions
   - Search by payment/refund ID
   - Export to CSV/PDF
   - State diff display

#### New Backend Endpoints Needed
```
GET /stores/:storeId/dashboard/metrics
  Returns: KPI data (revenue, counts, rates)

GET /stores/:storeId/refunds/pending
  Returns: Pending refunds list (paged, filtered)

GET /stores/:storeId/audit/admin-actions
  Returns: Admin approval/rejection history

GET /stores/:storeId/dashboard/charts/revenue
  Returns: Revenue trend data (for charts)

GET /stores/:storeId/dashboard/charts/refunds
  Returns: Refund trend data (for charts)
```

#### Frontend Components (Angular 22)
```
src/app/modules/admin/dashboard/
├── dashboard.component.ts
├── dashboard.component.html
├── dashboard.component.scss
├── components/
│   ├── kpi-cards/
│   ├── refund-table/
│   ├── audit-log-viewer/
│   └── charts/
└── services/
    └── dashboard.service.ts
```

### Implementation Order

**Day 1: Backend (4-5 hours)**
1. Create DashboardService for metrics/queries
2. Add 5 new endpoints to PaymentController
3. Implement chart data aggregation
4. Test endpoints with curl/Postman

**Day 2: Frontend (4-5 hours)**
1. Create dashboard layout (responsive)
2. Build KPI cards component
3. Build refund table with pagination
4. Integrate with backend APIs

**Day 3: Polish (2-3 hours)**
1. Add loading states
2. Add error handling
3. Add filters/search
4. Add export functionality

### Key Code Patterns (from Phase 9)

**Authorization**:
```typescript
@Component()
export class DashboardComponent {
  constructor(private auth: AuthContext) {}
  
  ngOnInit() {
    // Check admin role
    if (this.auth.role !== 'admin') {
      this.router.navigate(['/unauthorized']);
    }
  }
}
```

**Audit Logging**:
```typescript
// Every admin action logs automatically via AuditService
await AuditService.logAdminAction({
  storeId,
  actor: req.auth,
  resourceType: 'refund',
  action: 'approve',
  newState: {...},
  status: 'success'
});
```

**Rate Limiting**:
```typescript
// Dashboard endpoints use apiRateLimit (100 req/min)
router.get('/dashboard/metrics', apiRateLimit, async (req, res) => {
  // Implementation
});
```

### UI/UX Reference

**Dashboard Layout**:
```
┌─────────────────────────────────────┐
│ Admin Dashboard                     │
├─────────────────────────────────────┤
│ ┌──────┬──────┬──────┬──────┐      │
│ │ Rev  │Refnd │Pass  │Fail  │      │
│ │ $X   │ N    │ N%   │ N%   │      │
│ └──────┴──────┴──────┴──────┘      │
├─────────────────────────────────────┤
│ Pending Refunds                     │
│ ┌─────────────────────────────────┐ │
│ │ Amount│ Customer │ Date │ Action│ │
│ │ $100  │ John D   │ 2d   │ ✓ ✗  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Admin Actions                       │
│ [Timeline of approvals/rejections]  │
└─────────────────────────────────────┘
```

### Testing Checklist

- [ ] Authorization required (403 if not admin)
- [ ] Metrics load correctly
- [ ] Refund table displays data
- [ ] Approve/Reject buttons work
- [ ] Audit trail shows actions
- [ ] Filters work
- [ ] Export generates CSV
- [ ] Response times < 2s

### Files to Create/Modify

**New Backend Files**:
- `src/core/services/dashboard.service.ts` (new)
- `src/core/controllers/dashboard.controller.ts` (new)
- `src/core/routes/dashboard.routes.ts` (new)
- `src/app.ts` (register routes)

**New Frontend Files**:
- `src/app/modules/admin/dashboard/dashboard.component.*`
- `src/app/modules/admin/dashboard/services/dashboard.service.ts`
- `src/app/modules/admin/dashboard/components/*`

### Quick Links
- **Phase 9 Code**: See `/src/core/services/` for patterns
- **Database**: audit_logs_payment, payments, refunds tables
- **Authorization**: See `authorization.middleware.ts`
- **Tests**: See `payment.integration.test.ts` for patterns

### Estimated Effort
- **Backend**: 4-5 hours
- **Frontend**: 4-5 hours
- **Testing**: 2-3 hours
- **Total**: 10-13 hours (2-3 days)

### Success Criteria
- ✅ Admin can view KPIs
- ✅ Admin can approve/reject refunds
- ✅ Audit trail visible
- ✅ Filters work
- ✅ Charts display trends
- ✅ Load time < 2s
- ✅ Mobile responsive

---

**Ready to start Phase 10a when your next session begins!**

See `/PHASE_10_ROADMAP.md` for full plan.
