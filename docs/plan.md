Được, đây là plan chi tiết theo ngày, cập nhật đúng theo bản System Design mới nhất (đã có MongoDB audit log + security posture 2 tầng). Giữ khung 7 ngày như đã bàn, nhưng bổ sung phần Mongo vào đúng chỗ.

## Ngày 1 — Setup project + hoàn thiện Design Doc

```bash
nest new keyloop-document-viewer
cd keyloop-document-viewer
npm install @nestjs/axios @nestjs/config @nestjs/swagger @nestjs/mongoose mongoose
npm install ioredis class-validator class-transformer helmet opossum nestjs-pino
npm install --save-dev @types/opossum
```

Cấu trúc thư mục:
```
src/
├── documents/
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   ├── dto/search-vin.dto.ts
│   ├── interfaces/document.interface.ts
├── clients/
│   ├── sales-system.client.ts
│   ├── service-system.client.ts
├── audit/
│   ├── audit-log.schema.ts
│   ├── audit-log.service.ts
├── mocks/
│   ├── mock-sales.controller.ts
│   ├── mock-service.controller.ts
├── common/
│   ├── circuit-breaker/circuit-breaker.factory.ts
│   ├── cache/cache.service.ts
├── config/
│   ├── configuration.ts
├── app.module.ts
├── main.ts
```

Việc cần làm: `.env.example` (REDIS_URL, MONGO_URI, PORT, timeout configs), `docker-compose.yml` (Redis + MongoDB), commit Design Doc + AI_NOTES.md vào repo ngay từ đầu.

## Ngày 2 — Mock 2 external API + Client layer + Mongo schema

**Mock APIs**: `mock-sales.controller.ts` / `mock-service.controller.ts`, trả document giả theo VIN, hỗ trợ query param giả lập lỗi/delay:
```
GET /mock/sales?vin=XXX&simulateError=true&delay=5000
```

**Clients**: `SalesSystemClient`, `ServiceSystemClient` dùng `HttpService` từ `@nestjs/axios`, mỗi client set `timeout: 3000` riêng qua config.

**DTO chuẩn hoá document**:
```typescript
interface UnifiedDocument {
  id: string;
  title: string;
  type: string;
  sourceSystem: 'sales' | 'service';
  createdAt: string;
}
```

**Mongo schema** (`audit-log.schema.ts`):
```typescript
@Schema({ timestamps: true })
export class SearchAuditLog {
  @Prop({ required: true }) vin: string;
  @Prop() correlationId: string;
  @Prop({ type: Object }) sourceStatus: { sales: string; service: string };
  @Prop() latencyMs: number;
}
```

## Ngày 3 — Core logic: aggregation + resilience + audit write

`DocumentsService.searchByVin(vin, correlationId)`:
1. Check Redis (`cache:documents:{vin}`)
2. Nếu miss → `Promise.allSettled([salesClient.get(vin), serviceClient.get(vin)])`, mỗi call wrap qua `opossum` circuit breaker
3. Merge kết quả, tag `sourceStatus`
4. Gọi `auditLogService.record(...)` — **không await trước response**, dùng `.catch()` log lỗi riêng, không throw
5. Nếu ≥1 nguồn OK → set cache TTL 60s, trả `200`
6. Nếu cả 2 fail → trả `502`, không cache

Validate VIN bằng `class-validator`:
```typescript
@IsAlphanumeric()
@Length(17, 17)
vin: string;
```

Đây là ngày quan trọng nhất — dành nhiều thời gian nhất, vì đây là phần chấm điểm nặng nhất (Problem Solving + Technical Execution).

## Ngày 4 — Testing

**Jest (unit)** — mock cả 2 client, không gọi HTTP thật:
- Cả 2 nguồn OK → merge đúng
- 1 nguồn fail (rejected) → vẫn trả nguồn còn lại + `sourceStatus` đúng
- Cả 2 fail → throw/trả 502, không cache
- Cache hit → không gọi lại client
- Audit log ghi đúng dù response path nào

**Playwright (API integration)** — gọi thật qua mock endpoint có `simulateError=true`:
- Verify response contract (status code, shape)
- Verify header `x-correlation-id` xuyên suốt

## Ngày 5 — Observability + Security + Swagger

- `nestjs-pino`: middleware set `correlationId`, log mỗi client call với `latencyMs`
- OpenTelemetry SDK cơ bản: root span + 2 child span, export console
- Helmet + CORS config (theo đúng Section 6.1 trong Design Doc)
- `@nestjs/swagger`: setup `SwaggerModule`, decorate DTO/Controller đầy đủ để làm "frontend mock"
- Test thủ công qua Swagger UI, thử case lỗi 1 nguồn, cả 2 nguồn

## Ngày 6 — Docker Compose + README + AI Narrative

`docker-compose.yml`:
```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]
volumes:
  mongo_data:
```

README.md gồm: hướng dẫn build/run/test, mục AI Collaboration Narrative (tổng hợp từ `AI_NOTES.md` — nhớ đưa cả chi tiết "phát hiện thiếu persistent DB khi review lại design" vào đây, đó là ví dụ verification rất mạnh).

## Ngày 7 — Video + buffer

Quay theo cấu trúc: giới thiệu → design walkthrough (mở Mermaid diagram) → AI story (1-2 phút, kể case bắt lỗi thiếu Mongo) → demo live (VIN hợp lệ, rồi bật `simulateError=true` cho 1 mock để show `sourceStatus` degrade gracefully, rồi tắt cả 2 để show `502`) → learnings/challenges. Để buffer cho việc dựng/edit video hoặc fix bug phút chót.

---

Bạn muốn mình viết code skeleton thật (Ngày 1-2: controller, service, client, DTO, Mongo schema) để bạn có điểm khởi đầu ngay bây giờ không?