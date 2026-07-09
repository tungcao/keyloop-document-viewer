# Keyloop Unified Document Viewer

A resilient NestJS backend service that aggregates vehicle document metadata across two
legacy dealership platforms, with Redis caching, MongoDB audit logging, and per-source
circuit breakers.

---

## Quick Start

### 1. Prerequisites

- Node.js ≥ 20 (tested on v24)
- Docker + Docker Compose

### 2. Start infrastructure

```bash
docker compose up -d
```

Starts Redis (port 6379) and MongoDB (port 27017) with health checks.

### 3. Configure environment

```bash
cp .env.example .env
# .env.example values work out of the box for local development
```

### 4. Install dependencies

```bash
npm install
```

### 5. Run the app

```bash
npm run start:dev
```

The app starts on **http://localhost:3000**.

---

## API Reference

### OpenAPI / Swagger

Interactive docs available at:

```
http://localhost:3000/api/docs
```

### Main endpoint

```
GET /api/v1/documents/:vin
```

| Response | Condition |
|---|---|
| `200 OK` | At least one source responded with documents |
| `400 Bad Request` | VIN is not 17 alphanumeric characters |
| `404 Not Found` | Both sources confirmed no documents for this VIN |
| `502 Bad Gateway` | Both sources failed / circuit breakers open |

**Response shape:**
```json
{
  "vin": "1HGCR2F8XHA000001",
  "documents": [
    {
      "id": "sales-1HGCR2F8XHA000001-1",
      "title": "Sales Order #SO-0001",
      "type": "sales_order",
      "sourceSystem": "sales",
      "createdAt": "2026-07-09T00:00:00.000Z"
    }
  ],
  "meta": {
    "sourceStatus": { "sales": "ok", "service": "ok" },
    "cacheHit": false
  }
}
```

### Mock endpoints (for resilience testing)

```
GET /mock/sales?vin=XXX&simulateError=true&delay=5000
GET /mock/service?vin=XXX&simulateError=true&delay=5000
```

- **`simulateError=true`** — returns HTTP 500 after `delay` ms
- **`delay=N`** — introduces N ms latency (tests timeout behaviour)
- VIN `00000000000000000` — returns empty array (no documents found)

---

## Running Tests

### Unit tests (Jest)

```bash
npm test
```

Covers 6 scenarios in `DocumentsService`: both succeed, one fails, both fail (502),
both empty (404), cache hit, and audit log write failure resilience.

```bash
npm test -- --coverage   # with coverage report
```

### End-to-end tests (Playwright)

Requires the app to be running (`npm run start:dev`) and infrastructure up
(`docker compose up -d`).

```bash
npx playwright test
```

Covers: happy path (200), mock error simulation, invalid VIN (400),
correlation ID header echo, and cache-hit verification.

```bash
npx playwright show-report   # view HTML report after a run
```

### Build

```bash
npm run build   # compiles to dist/
npm run lint    # ESLint
```

---

## Architecture

```
Client → NestJS API (Helmet, ValidationPipe, Pino)
           ├── Cache check (Redis, TTL 60s)
           └── Cache miss → Promise.allSettled fan-out
                 ├── Circuit Breaker (opossum) → SalesSystemClient
                 └── Circuit Breaker (opossum) → ServiceSystemClient
                       └── Fire-and-forget → MongoDB SearchAuditLog
```

Full design rationale: [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MONGO_URI` | `mongodb://localhost:27017/document-viewer` | MongoDB connection string |
| `SALES_API_URL` | `http://localhost:3000/mock/sales` | Sales system base URL |
| `SERVICE_API_URL` | `http://localhost:3000/mock/service` | Service system base URL |
| `DOWNSTREAM_TIMEOUT_MS` | `3000` | Per-source HTTP timeout |
| `CACHE_TTL_SECONDS` | `60` | Redis cache TTL |

---

## AI Collaboration Narrative

### How AI was used in this implementation

This project was built in a single session with Antigravity (Google DeepMind), using
a structured spec-driven workflow:

**Design phase** (prior to this session): Claude and Grok were used as design collaborators
to stress-test architectural decisions — see [`docs/SYSTEM_DESIGN.md` §8](docs/SYSTEM_DESIGN.md)
and [`AI_NOTES.md`](AI_NOTES.md) for the full log.

**Implementation phase** (this session): The agent was given `AGENT_SPEC.md` as the
authoritative implementation spec and `ANTIGRAVITY_PROMPT.md` as the session prompt.
It implemented all 13 steps in the specified order, stopping after each numbered step
for review.

**What worked well:**
- The spec-driven approach eliminated back-and-forth: the agent read the spec once and
  produced correct file structure, contracts, and business logic on the first pass.
- The `ASSUMPTION:` comment convention from §0 was followed when `opossum`'s CommonJS
  import style required a deviation — the agent flagged it inline rather than silently
  choosing an approach.
- Test-alongside-implementation (§5) worked: 6/6 Jest tests were written and passed in
  the same step as the service, not deferred.

**What required correction:**
- The opossum `import * as CircuitBreaker` pattern caused a TypeScript construct
  error — fixed by switching to `import CircuitBreaker = require('opossum')` with an
  eslint-disable comment, which is the correct pattern for CJS modules in strict TS.
- The audit log failure test initially leaked an unhandled rejection into the Node
  process — corrected by having the mock mirror the real service's internal `.catch()`
  pattern.

**Human decisions retained throughout:**
- The `Promise.allSettled` requirement (§4) was a hard spec constraint; the agent
  respected it and never attempted `Promise.all`.
- Scope boundaries (no auth, no queue, no frontend) were respected without prompting.
- Each step was reviewed before the next began, catching the opossum issue before it
  propagated into dependent files.

**Conclusion:** The agent was most effective as an implementation accelerator when given
a precise, constraint-explicit spec. The review-per-step cadence was the key control
that kept the session on track — it's the reason this submission can be explained
line-by-line rather than just run.
