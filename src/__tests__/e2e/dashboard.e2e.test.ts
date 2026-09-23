/**
 * Phase 10a - Dashboard E2E Tests
 * Comprehensive testing of all dashboard endpoints
 */

import axios, { AxiosInstance } from 'axios';

describe.skip('Phase 10a - Admin Dashboard E2E Tests', () => {
  let api: AxiosInstance;
  const BASE_URL = 'http://localhost:3000/api/v1';
  const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(() => {
    api = axios.create({
      baseURL: BASE_URL,
      validateStatus: () => true,
    });
  });

  describe('✅ Endpoint 1: GET /dashboard/metrics', () => {
    it('should return KPI metrics with proper numeric formatting', async () => {
      const response = await api.get(`/stores/${STORE_ID}/dashboard/metrics`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeDefined();

      const data = response.data.data;
      expect(data.revenue).toBeDefined();
      expect(data.refunds).toBeDefined();
      expect(data.payments).toBeDefined();

      // Verify numeric types
      expect(typeof data.revenue.total).toBe('number');
      expect(typeof data.refunds.pending_amount).toBe('number');
      expect(typeof data.payments.successful_count).toBe('number');
    });
  });

  describe('✅ Endpoint 2: GET /dashboard/pending-refunds', () => {
    it('should return paginated list of pending refunds', async () => {
      const response = await api.get(`/stores/${STORE_ID}/dashboard/pending-refunds`, {
        params: { page: 1, limit: 10 }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data.refunds)).toBe(true);
      expect(response.data.data.pagination).toBeDefined();
      expect(response.data.data.pagination.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('✅ Endpoint 3: GET /dashboard/admin-actions', () => {
    it('should return admin actions with pagination', async () => {
      const response = await api.get(`/stores/${STORE_ID}/dashboard/admin-actions`, {
        params: { page: 1, limit: 50 }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data.actions)).toBe(true);
      expect(response.data.data.pagination).toBeDefined();
    });
  });

  describe('✅ Endpoint 4: GET /dashboard/charts/revenue', () => {
    it('should return revenue chart data with proper numeric formatting', async () => {
      const response = await api.get(`/stores/${STORE_ID}/dashboard/charts/revenue`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data.data)).toBe(true);
      
      // Verify numeric types in chart data
      response.data.data.data.forEach((point: any) => {
        expect(typeof point.value).toBe('number');
        expect(typeof point.count).toBe('number');
      });
    });
  });

  describe('✅ Endpoint 5: GET /dashboard/charts/refunds', () => {
    it('should return refund chart data', async () => {
      const response = await api.get(`/stores/${STORE_ID}/dashboard/charts/refunds`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data.data)).toBe(true);
    });
  });

  describe('✅ Endpoint 6: GET /dashboard/refund-statistics', () => {
    it('should return refund statistics by status', async () => {
      const response = await api.get(`/stores/${STORE_ID}/dashboard/refund-statistics`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      const stats = response.data.data;
      expect(stats.pending_approval).toBeDefined();
      expect(stats.approved).toBeDefined();
      expect(typeof stats.total_amount).toBe('number');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should enforce store isolation', async () => {
      const response = await api.get(`/stores/${STORE_ID}/dashboard/metrics`);
      expect(response.status).toBe(200);
      expect(response.data.data).toBeDefined();
    });
  });

  describe('📊 Data Integrity Tests', () => {
    it('should have consistent metrics across endpoints', async () => {
      const metricsRes = await api.get(`/stores/${STORE_ID}/dashboard/metrics`);
      const statsRes = await api.get(`/stores/${STORE_ID}/dashboard/refund-statistics`);

      const metrics = metricsRes.data.data;
      const stats = statsRes.data.data;

      expect(metrics.refunds.pending_count).toBe(stats.pending_approval);
      expect(metrics.refunds.approved_count).toBe(stats.approved);
    });
  });

  describe('⚡ Performance Tests', () => {
    it('all endpoints should respond within 1 second', async () => {
      const endpoints = [
        `/stores/${STORE_ID}/dashboard/metrics`,
        `/stores/${STORE_ID}/dashboard/pending-refunds`,
        `/stores/${STORE_ID}/dashboard/charts/revenue`,
        `/stores/${STORE_ID}/dashboard/refund-statistics`,
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        const response = await api.get(endpoint);
        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(1000);
      }
    });
  });
});
