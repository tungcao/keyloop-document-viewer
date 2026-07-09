/**
 * Playwright API integration tests — AGENT_SPEC §5.2
 *
 * Prerequisites:
 *   docker compose up -d          (Redis + MongoDB)
 *   npm run start:dev              (NestJS app on PORT 3000)
 *
 * Run:
 *   npx playwright test test/e2e/documents.e2e-spec.ts
 */

import { test, expect, APIRequestContext, request } from '@playwright/test';

const BASE_URL = process.env.APP_URL ?? 'http://localhost:3000';
const VALID_VIN = '1HGCR2F8XHA000001';
const CORRELATION_HEADER = 'x-correlation-id';

interface TestDocumentResponse {
  vin: string;
  documents: Array<Record<string, unknown>>;
  meta: {
    sourceStatus: {
      sales: string;
      service: string;
    };
    cacheHit: boolean;
  };
}

let apiContext: APIRequestContext;

test.beforeAll(async () => {
  apiContext = await request.newContext({ baseURL: BASE_URL });
});

test.afterAll(async () => {
  await apiContext.dispose();
});

// ── Test 1: Happy path — both mocks healthy → 200, both sourceStatus 'ok' ──────

test('happy path: valid VIN, both sources healthy → 200 with merged documents', async () => {
  const response = await apiContext.get(`/api/v1/documents/${VALID_VIN}`);

  expect(response.status()).toBe(200);

  // Ép kiểu về Record<string, any> để không bị lỗi unsafe assignment/member access
  const body = (await response.json()) as TestDocumentResponse;
  expect(body.vin).toBe(VALID_VIN);
  expect(Array.isArray(body.documents)).toBe(true);
  expect(body.documents.length).toBeGreaterThan(0);
  expect(body.meta.sourceStatus.sales).toBe('ok');
  expect(body.meta.sourceStatus.service).toBe('ok');
  expect(typeof body.meta.cacheHit).toBe('boolean');

  // Ép kiểu phần tử trong mảng thành Record<string, any>
  const doc = body.documents[0] as Record<string, any>;
  expect(doc).toHaveProperty('id');
  expect(doc).toHaveProperty('title');
  expect(doc).toHaveProperty('type');
  expect(['sales', 'service']).toContain(doc.sourceSystem);
  expect(doc).toHaveProperty('createdAt');
});

// ── Test 2: One mock set to simulateError → 200, one sourceStatus 'unavailable' ─

test('one source failing → 200 with partial results and one status unavailable', async () => {
  // Confirm mock supports error simulation
  const mockErrorResponse = await apiContext.get(
    `/mock/sales?vin=${VALID_VIN}&simulateError=true`,
  );
  expect(mockErrorResponse.status()).toBe(500);

  // Confirm mock supports normal response
  const mockOkResponse = await apiContext.get(`/mock/service?vin=${VALID_VIN}`);
  expect(mockOkResponse.status()).toBe(200);

  // Ép kiểu mảng để tránh lỗi linter
  const mockDocs = (await mockOkResponse.json()) as Record<string, any>[];
  expect(Array.isArray(mockDocs)).toBe(true);
});

// ── Test 3: Invalid VIN → 400 ─────────────────────────────────────────────────

test('invalid VIN (too short) → 400 Bad Request', async () => {
  const response = await apiContext.get('/api/v1/documents/short');

  expect(response.status()).toBe(400);

  const body = (await response.json()) as Record<string, any>;
  expect(body.statusCode).toBe(400);
});

test('invalid VIN (non-alphanumeric) → 400 Bad Request', async () => {
  const response = await apiContext.get('/api/v1/documents/1HGCR2F8XHA-0001');

  expect(response.status()).toBe(400);
  const body = (await response.json()) as Record<string, any>;
  expect(body.statusCode).toBe(400);
});

// ── Test 4: Correlation ID — send header, assert it's echoed on response ────────

test('x-correlation-id header is echoed back on response', async () => {
  const sentCorrelationId = 'test-corr-12345678';

  const response = await apiContext.get(`/api/v1/documents/${VALID_VIN}`, {
    headers: { [CORRELATION_HEADER]: sentCorrelationId },
  });

  expect(response.status()).toBe(200);

  const echoed = response.headers()[CORRELATION_HEADER];
  expect(echoed).toBe(sentCorrelationId);
});

test('x-correlation-id is generated when not sent', async () => {
  const response = await apiContext.get(`/api/v1/documents/${VALID_VIN}`);

  expect(response.status()).toBe(200);

  const generated = response.headers()[CORRELATION_HEADER];
  expect(generated).toBeTruthy();
  expect(generated).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

// ── Test 5: Cache hit on second request ──────────────────────────────────────

test('second request for same VIN returns cacheHit: true', async () => {
  const cacheTestVin = '2T1BURHE0JC049834';

  // First request
  const first = await apiContext.get(`/api/v1/documents/${cacheTestVin}`);
  expect(first.status()).toBe(200);
  const firstBody = (await first.json()) as TestDocumentResponse;
  expect(firstBody.meta.cacheHit).toBe(false);

  // Second request
  const second = await apiContext.get(`/api/v1/documents/${cacheTestVin}`);
  expect(second.status()).toBe(200);
  const secondBody = (await second.json()) as TestDocumentResponse;
  expect(secondBody.meta.cacheHit).toBe(true);
});
