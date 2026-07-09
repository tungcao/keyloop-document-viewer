# AGENT_SPEC.md — Implementation Spec for Unified Document Viewer

> This file is the single source of truth for implementation. Follow it exactly.
> Do not ask clarifying questions unless something here is genuinely ambiguous or
> contradictory — if unclear, make the most reasonable assumption, implement it, and
> add a one-line comment `// ASSUMPTION: ...` at that point in the code.
> Full design rationale is in `SYSTEM_DESIGN.md` — read it once for context, then work
> from this file for concrete implementation tasks.

---

## 0. Ground rules

- Language: TypeScript, strict mode.
- Framework: NestJS.
- Do NOT introduce libraries not listed in Section 1 without asking first.
- Do NOT build a frontend UI. The "frontend" deliverable is the Swagger/OpenAPI page only.
- Keep each file focused — one class/concern per file, matching the structure in Section 2.
- After generating each module, run `npm run build` and `npm run lint` mentally (i.e.
  produce code that would pass) — no unused imports, no `any` unless justified with a comment.
- Write code, then write its test, in the same step — do not defer all tests to the end.

---

## 1. Dependencies (exact list — do not add others without confirming)

I installed the list bellow, just skip this step:

```
@nestjs/axios @nestjs/config @nestjs/swagger @nestjs/mongoose mongoose
ioredis class-validator class-transformer helmet opossum nestjs-pino
uuid
```

Dev: `@types/opossum @types/uuid jest supertest @playwright/test`

---

## 2. File structure to create

```
src/
├── documents/
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   ├── documents.module.ts
│   ├── dto/search-vin.dto.ts
│   ├── dto/document-response.dto.ts
│   ├── interfaces/unified-document.interface.ts
│   ├── documents.service.spec.ts
├── clients/
│   ├── sales-system.client.ts
│   ├── service-system.client.ts
│   ├── clients.module.ts
├── audit/
│   ├── audit-log.schema.ts
│   ├── audit-log.service.ts
│   ├── audit.module.ts
├── mocks/
│   ├── mock-sales.controller.ts
│   ├── mock-service.controller.ts
│   ├── mocks.module.ts
├── common/
│   ├── circuit-breaker/circuit-breaker.factory.ts
│   ├── cache/cache.service.ts
│   ├── cache/cache.module.ts
│   ├── middleware/correlation-id.middleware.ts
├── config/
│   ├── configuration.ts
├── app.module.ts
├── main.ts
test/
├── e2e/documents.e2e-spec.ts   (Playwright)
docker-compose.yml
.env.example
README.md
```

---

## 3. Contracts (implement exactly as specified)

### 3.1 `UnifiedDocument` interface

```typescript
interface UnifiedDocument {
  id: string;
  title: string;
  type: string;
  sourceSystem: 'sales' | 'service';
  createdAt: string; // ISO 8601
}
```

### 3.2 API endpoint

```
GET /api/v1/documents/:vin
```

**Success (200)**:

```json
{
  "vin": "1HGCR2F8XHA000001",
  "documents": [ /* UnifiedDocument[] */ ],
  "meta": {
    "sourceStatus": { "sales": "ok", "service": "unavailable" },
    "cacheHit": false
  }
}
```

**Both sources failed → 502**:

```json
{ "statusCode": 502, "message": "Both source systems are unavailable" }
```

**VIN not found on either system (both returned empty/404, not error) → 404**:

```json
{ "statusCode": 404, "message": "No documents found for this VIN" }
```

**Invalid VIN format → 400** (handled automatically by `class-validator` + Nest's
`ValidationPipe`).

### 3.3 Mock endpoints

```
GET /mock/sales?vin=XXX&simulateError=true&delay=5000
GET /mock/service?vin=XXX&simulateError=true&delay=5000
```

- `simulateError=true` → respond with HTTP 500 after `delay` ms (default delay 0).
- No error param → respond 200 with 2-4 fake documents for that VIN, `sourceSystem` set
  accordingly, after `delay` ms.
- If `vin` matches a hardcoded "not found" test VIN (use `"00000000000000000"`), return 200
  with empty array (simulates legitimately no documents).

### 3.4 `SearchAuditLog` Mongo schema

```typescript
{
  vin: string;           // required
  correlationId: string;
  sourceStatus: { sales: string; service: string };
  latencyMs: number;
  createdAt: Date;       // via { timestamps: true }
}
```

Write is **fire-and-forget**: call `.catch(err => logger.error(...))`, never `await` it
before sending the HTTP response.

### 3.5 Config (env vars, see `.env.example`)

```
PORT=3000
REDIS_URL=redis://localhost:6379
MONGO_URI=mongodb://localhost:27017/document-viewer
SALES_API_URL=http://localhost:3000/mock/sales
SERVICE_API_URL=http://localhost:3000/mock/service
DOWNSTREAM_TIMEOUT_MS=3000
CACHE_TTL_SECONDS=60
```

---

## 4. Business logic — exact behavior

`DocumentsService.searchByVin(vin, correlationId)`:

1. Validate VIN already happened at controller (DTO). Assume valid here.
2. `cacheService.get(`documents:${vin}`)` → if hit, return cached payload with
   `meta.cacheHit: true`, skip everything below.
3. On miss: fire both client calls concurrently via `Promise.allSettled`, each wrapped in
   its own opossum circuit breaker instance (one breaker per client, not shared).
4. Each client call has its own timeout from `DOWNSTREAM_TIMEOUT_MS`.
5. Build `sourceStatus`: `'ok'` if fulfilled, `'unavailable'` if rejected/timeout/breaker-open.
6. If both `sourceStatus` are `'unavailable'` → throw a `BadGatewayException` (502). Do NOT
   cache. Still write the audit log (fire-and-forget) before throwing.
7. If both succeeded but both returned empty arrays → throw `NotFoundException` (404). Do
   NOT cache an empty result. Still write audit log.
8. Otherwise: merge non-empty document arrays, cache the full response payload
   (`CACHE_TTL_SECONDS`), fire-and-forget the audit log, return payload with
   `meta.cacheHit: false`.
9. Every audit log write includes real `latencyMs` measured from start of step 3 to end of
   step 8 (or step 6/7 for early exits).

**Do not use `Promise.all`.** This is a hard requirement — one rejected promise must never
throw before both settle.

---

## 5. Testing requirements (write alongside implementation, not after)

### 5.1 Jest — `documents.service.spec.ts`

Mock `SalesSystemClient` and `ServiceSystemClient` (do not hit real HTTP). Cover:

- Both succeed → correct merge, `sourceStatus` both `'ok'`, cache is set.
- Sales fails, Service succeeds → `sourceStatus.sales === 'unavailable'`, documents from
  Service only, still 200.
- Both fail → throws `BadGatewayException`, cache NOT set.
- Both succeed but empty → throws `NotFoundException`.
- Cache hit → clients never called (assert with `jest.fn()` call count = 0).
- Audit log write failure does not throw or affect the response (mock a rejected write).

### 5.2 Playwright — `test/e2e/documents.e2e-spec.ts`

Run against the real running app + mock endpoints. Cover:

- Happy path: valid VIN, both mocks healthy → 200, both `sourceStatus: 'ok'`.
- One mock set to `simulateError=true` via env/test setup → 200, one status `'unavailable'`.
- Invalid VIN (`"short"`) → 400.
- Correlation ID: send `x-correlation-id` header, assert it's echoed/logged (check response
  header or log output as feasible).

---

## 6. Explicitly out of scope — do not implement

- No auth/JWT/RBAC (documented as production-only in `SYSTEM_DESIGN.md` Section 6.2).
- No WAF/rate-limiting middleware.
- No frontend framework/UI of any kind.
- No BullMQ or any queue.
- No relational database.

If you (the agent) find yourself about to add any of the above, stop and flag it instead
of implementing it.

---

## 7. Order of implementation (follow this sequence)

1. `config/configuration.ts` + `.env.example` + `app.module.ts` skeleton
2. `mocks/` — both mock controllers (needed before real clients can be tested against them)
3. `clients/` — both HTTP clients + `clients.module.ts`
4. `common/cache/` — Redis wrapper service
5. `common/circuit-breaker/` — opossum factory helper
6. `audit/` — Mongo schema + service
7. `documents/` — DTOs, interfaces, service (Section 4 logic), controller
8. `documents.service.spec.ts` (Jest)
9. `common/middleware/correlation-id.middleware.ts` + wire into `main.ts` with Pino
10. Swagger setup in `main.ts`
11. `docker-compose.yml`
12. `test/e2e/documents.e2e-spec.ts` (Playwright)
13. `README.md` (build/run/test instructions + AI Collaboration Narrative placeholder)

Do not jump ahead — each step depends on the previous one existing and compiling.
