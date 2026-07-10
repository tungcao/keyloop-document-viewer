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

The app starts on **<http://localhost:3000>**.

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

### Static analysis (duplication / dead code)

```bash
npx jscpd src --min-lines 15 --min-tokens 30   # duplicate code detection
npx knip                                       # unused files/exports/dependencies
```

---

## Architecture

```
Client → NestJS API (Helmet, ValidationPipe, Pino, OpenTelemetry)
           ├── Cache check (Redis, TTL 60s)
           └── Cache miss → Promise.allSettled fan-out
                 ├── Circuit Breaker (opossum) → SalesSystemClient
                 └── Circuit Breaker (opossum) → ServiceSystemClient
                       └── Fire-and-forget → MongoDB SearchAuditLog
```

Full design rationale, architecture diagrams, and security posture:
[`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md)

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

AI was used across the full lifecycle of this submission — scenario selection, system
design, implementation, and debugging — with three different tools (Claude, Grok,
Antigravity/Gemini) playing different roles at different stages. The full raw log is kept
in [`AI_NOTES.md`](AI_NOTES.md); this section summarizes the strategy, the verification
process, and how final quality was ensured.

### Strategy: what AI was used for, and what it wasn't

**Used AI for:** widening the option space before deciding (comparing scenarios and
tech-stack proposals), generating boilerplate/implementation from a locked spec, and
first-pass debugging of unfamiliar errors (CSP, Helmet, TypeScript/ESLint edge cases).

**Did not delegate to AI:** the final choice of scenario, the final tech stack, whether a
proposed pattern actually fit this problem, and whether the security-posture document
was honest about what was actually implemented. Every one of these was a decision I made
after AI provided input — not a decision AI made for me. The pattern that repeats
throughout the log is: **ask multiple sources → cross-check them against each other →
apply my own judgment about scope and correctness.**

### Verification: concrete cases where AI output was wrong, incomplete, or overstated

These are not hypothetical — each was caught during this project and corrected before
being carried forward:

| Stage | What AI produced | What was wrong / missing | Correction |
|---|---|---|---|
| Scenario selection | Claude and Grok both leaned toward Scenario A (booking/concurrency) as the strongest choice for a Lead role | Neither AI weighed *my* one-week execution risk on an unfamiliar domain (time-range locking) | Chose **Scenario D** instead — a deliberate risk/scope call the AI didn't make for me |
| Reusing prior code | Considered reusing a Redis `decrBy` stock-decrement pattern from an earlier project | Claude identified that atomic counter decrement doesn't translate to time-range overlap booking — a real design flaw if copied blindly into Scenario A | Confirmed as a supporting reason to prefer D over A |
| Tech stack | Grok proposed a full Next.js frontend, a monorepo, BullMQ for audit logging, and MSW | All four were scope creep for a one-layer, one-week deliverable | Asked Claude to critically review Grok's proposal; cut all four myself after evaluating the trade-offs, kept only the genuinely useful parts (class-validator, Jest, Mermaid) |
| System Design Doc | An early AI-assisted draft used Redis as the *only* data store | This does **not** satisfy the challenge's explicit "use a persistent database" requirement — Redis is a cache, not a system of record | Added MongoDB (`SearchAuditLog`) as the actual persistence layer, chosen for genuine operational value, not just to satisfy a checklist |
| Design Doc formatting (Gemini) | Markdown structure broke on render; contained a VIN example (`VINVIN1234567890`) that isn't a valid 17-character VIN; used white text on a light-yellow background | Rendering bug, factual inaccuracy, and an accessibility/contrast issue | Forced raw-markdown output via code block, corrected the VIN example to a real 17-char format (`1HGCR2F8XHA000001`), manually fixed the text color |
| Security section (Gemini) | Listed JWT/RBAC/Cloudflare WAF under a single "security strategy" section, implying they were implemented | None of these were actually built — this would not have survived a follow-up interview question | Split Section 6 into **"Implemented in this submission"** vs. **"Production considerations, out of scope"** so the doc never overstates what the code does |
| Implementation (Antigravity) | Mock controllers (`MockSalesController`, `MockServiceController`) each defined their own local `MockDocument` interface | Duplicated the existing `UnifiedDocument` interface under a different name — a maintainability risk (drift over time) | Caught via manual code review, then set up `jscpd` and `knip` as repeatable static-analysis checks so this class of issue is caught automatically going forward, not just by eyeballing |
| Debugging: Swagger blank page | Gemini's first fix (whitelisting `unpkg.com` in CSP) didn't work | Swagger UI assets are served same-origin, not from `unpkg.com` — the fix targeted the wrong cause | Diagnosed via actual browser console errors instead of guessing again; found the real cause was Helmet's default HSTS header combined with Safari's HTTP-HSTS quirk forcing HTTPS on `localhost` |
| Design vs. implementation drift | `SYSTEM_DESIGN.md` documented OpenTelemetry tracing; the Antigravity-generated code did not include it | A design doc / code mismatch — exactly the kind of gap an interviewer would probe | Caught by re-reading the design doc against the actual source tree, then implemented a minimal root-span + child-span setup exporting to console |

### Quality ownership: how the final code was verified, beyond "does it run"

- **Static analysis, not just manual review**: `knip` (unused files/exports/dependencies),
  `jscpd` (duplicate code), and ESLint with `eslint-plugin-sonarjs` were added specifically
  because manual review had already missed one duplication issue — the tooling exists to
  catch the *next* one automatically rather than relying on catching it by eye every time.
- **Spec-driven implementation, reviewed per step**: Antigravity was given `AGENT_SPEC.md`
  (the authoritative implementation spec derived from `SYSTEM_DESIGN.md`) and a prompt
  instructing it to implement in a fixed order, pausing after each step for review — this
  caught issues (like the mock-controller duplication) close to where they were introduced,
  rather than after the whole codebase was generated.
- **Tests written alongside code, not after**: the Jest suite for `DocumentsService` covers
  all six business-logic branches (both sources succeed, one fails, both fail, both empty,
  cache hit, audit-log failure) and was written in the same implementation step as the
  service itself, per `AGENT_SPEC.md` §0.
- **Every non-trivial assumption is documented inline** (`// ASSUMPTION: ...`) and in
  `SYSTEM_DESIGN.md` §7, rather than silently decided by whichever tool wrote that code.
- **Lint failures were treated as real signal**: after the initial generation pass,
  `npm run lint` reported 28 problems; each was fixed individually rather than suppressed,
  including type-safety fixes (correcting hand-written middleware to use Express's
  `Request`/`Response`/`NextFunction` types instead of raw Node `IncomingMessage`/
  `ServerResponse`, which had been silently accepted by `any`-shaped code).

### Tools used

- **Claude** — architecture trade-off analysis, critical review of the other AI's
  proposals, spec authoring (`AGENT_SPEC.md`), and debugging (CSP/HSTS root-cause analysis).
- **Grok** — a second, independent source of design/stack proposals, used specifically to
  cross-check Claude's recommendations rather than being followed on its own.
- **Gemini** — System Design Document drafting and first-pass debugging suggestions.
- **Antigravity (Google, agentic IDE)** — implementation of the NestJS codebase from the
  locked spec, in a single reviewed, step-by-step session.

**Conclusion**: across every stage, AI outputs required correction — sometimes minor
(formatting, an invalid example value), sometimes substantive (a missing persistent
database, an overstated security claim, a duplicated type, a wrong root-cause diagnosis).
None of these were caught by trusting AI output at face value; all were caught by
cross-checking sources against each other, reading actual error output instead of
guessing, and re-reading the design doc against the real code. That verification loop —
not any single AI tool — is what this submission's quality rests on.
