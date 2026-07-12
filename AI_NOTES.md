# AI Collaboration Notes

Ghi log liên tục trong quá trình làm Keyloop Technical Assessment.
Mục đích: làm nguyên liệu thô để viết AI Collaboration Narrative trong README.md.
Format: mỗi mục ghi ngắn gọn — bối cảnh, AI đề xuất gì, mình phản biện/quyết định gì.

---

## Giai đoạn 1: Chọn Scenario (Design Phase)

- **Bối cảnh**: Có 4 scenario (A/B/C/D). Ban đầu định chọn Scenario C (Sales Lead Management)
  vì hợp techstack frontend hiện có.
- **Hỏi Claude**: phân tích trade-off giữa 4 scenario theo góc nhìn Engineering Team Lead.
- **AI đề xuất**: C an toàn nhưng độ phức tạp kỹ thuật thấp, ít đất thể hiện system design;
  gợi ý cân nhắc A (concurrency/booking) hoặc D (integration/aggregation) vì có nhiều "răng cưa"
  kỹ thuật hơn, phù hợp hơn cho vai trò lead.
- **Đối chiếu thêm với Grok**: Grok đưa ra bảng so sánh tương tự, cũng nghiêng về D hoặc A.
- **Quyết định của mình**: Yêu cầu Claude phân tích sâu Scenario A (concurrency/locking) trước.
  Sau khi thấy A đòi hỏi thiết kế transaction/locking cho time-range overlap — một domain
  mình chưa có kinh nghiệm thực chiến, trong khi chỉ có 1 tuần — mình tự đánh giá rủi ro
  thực thi quá cao. Chuyển sang cân nhắc D.
- **Kết luận cuối**: Tự chốt **Scenario D** dựa trên 3 lý do tự đưa ra: (1) rủi ro thực thi
  thấp hơn A trong 1 tuần, (2) sát với kinh nghiệm thực tế (Playwright API automation,
  eKYC third-party integration), (3) vẫn đủ độ khó về resilience/system design cho vai trò Lead.
  → Đây là quyết định của mình, không phải AI chọn hộ.

---

## Giai đoạn 2: Đánh giá code cũ để quyết định tái sử dụng

- **Bối cảnh**: Có sẵn code `order.controller.ts` / `order.service.ts` (dự án BullMQ xử lý
  kho trước đây), muốn biết có tái dùng được cho Scenario A/D không.
- **Hỏi Claude**: phân tích khả năng tái sử dụng Redis + BullMQ + Mongo pattern.
- **AI chỉ ra điểm sai lệch quan trọng**: pattern `redisClient.decrBy()` (atomic counter)
  trong code cũ chỉ phù hợp bài toán đếm số lượng (stock), **không** áp dụng thẳng được cho
  bài toán time-range overlap (appointment) — vì không có gì để "trừ" trong một khung giờ.
  Đây là insight quan trọng giúp mình tránh sai lầm nếu chọn A và copy pattern cũ.
- **Quyết định của mình**: Ghi nhận, dùng làm 1 trong các lý do củng cố quyết định chọn D
  thay vì A (A cần thiết kế lại gần như từ đầu phần lõi khó nhất).

---

## Giai đoạn 3: Chốt tech stack cho Scenario D

- **Hỏi Claude**: gợi ý tech stack cho D dựa trên background hiện có (NestJS, Redis, Mongo,
  Playwright, kinh nghiệm integration eKYC).
- **AI đề xuất**: NestJS + `@nestjs/axios` + Redis cache + `opossum` circuit breaker +
  `Promise.allSettled` cho parallel call + Pino/OpenTelemetry cho observability + Jest/Playwright
  cho test. Khuyến nghị KHÔNG build UI đầy đủ, chỉ cần Swagger/API contract vì đề bài chỉ
  yêu cầu implement đầy đủ 1 layer.
- **Đối chiếu với đề xuất của Grok**: Grok gợi ý thêm Next.js 15 + shadcn/ui + TanStack Query
  cho frontend, monorepo (apps/packages), BullMQ cho audit log, MSW cho frontend testing.
- **Mình yêu cầu Claude phản biện lại đề xuất của Grok** để kiểm chứng chéo trước khi quyết.
- **AI (Claude) chỉ ra rủi ro**: Grok's stack thiết kế như dự án production 2 layer đầy đủ,
  trong khi đề bài rõ ràng chỉ cần đào sâu **một** layer trong 1 tuần. Cụ thể:
  - Next.js/shadcn/TanStack Query đầy đủ → scope creep, tốn thời gian không cần thiết
    nếu backend là layer chính.
  - Monorepo (apps/packages) → over-engineering cho quy mô 1 service, thời gian ngắn.
  - BullMQ cho audit log → thêm dependency không cần thiết cho bài toán read-only.
  - MSW → chỉ cần nếu thực sự build frontend riêng.
- **Quyết định của mình**: Đồng ý với phần lớn phản biện của Claude, **tự quyết định** giữ lại
  2 điểm hay từ Grok (class-validator/class-transformer, Jest bổ sung cho Playwright, Mermaid
  cho diagram) nhưng **cắt bỏ** Next.js, monorepo, BullMQ, MSW để giữ đúng scope 1 tuần.
  → Đây là bước tự tổng hợp/lọc giữa 2 nguồn AI, không nhận nguyên xi từ bên nào.

---

## Giai đoạn 4: Lập kế hoạch thực thi

- **Hỏi Claude**: chia lộ trình 7 ngày cụ thể cho Scenario D (setup → design doc → mock API
  → core logic → test → observability/docker → README/narrative → video/buffer).
- **AI đề xuất**: lộ trình theo ngày, có cấu trúc module NestJS cụ thể.
- **Quyết định của mình**: Chấp nhận cấu trúc lộ trình làm khung sườn, sẽ điều chỉnh linh hoạt
  theo tiến độ thực tế trong quá trình code.

---

## Giai đoạn 5: Viết System Design Document

- Bối cảnh: Trước khi bắt đầu vào code, tôi viết system design, sử dụng tech stack từ kế hoạch ở bước 4
- AI generate: Sử dụng Gemini để generate
- Vấn đề phát hiện: tôi review thấy Gemini trả lời bị vỡ cấu trúc .md không đúng structure nên không render được
- Hành động: tôi yêu cầu Gemini generate lại với cú pháp: Provide the entire markdown raw text inside a code block using three tildes (~~~) as the start and end containers.
- Vấn đề 2: Sau đó tôi review thì Gemini set màu cho external text màu trắng bị chìm trên nền vàng nhạt
- Hành động 2: tôi set lại bằng tay thành màu đen.
- Vấn đề 3: Ở Dataflow Gemini tạo sample VINVIN1234567890, sai so với 17 ký tự VIN
- Hành động 3: Tôi đổi thành 1HGCR2F8XHA000001 để đúng thực tế 17 ký tự.

- AI generate: Tôi nhờ Gemini bổ sung thêm Top 10 OWASP để đảm bảo bảo mật.
- Vấn đề phát hiện: Gemini liệt kê JWT/RBAC/Cloudflare WAF như thể đã triển khai.
- Hành động: tôi yêu cầu Gemini tách mục bảo mật thành 2 phần rõ ràng — "Implemented in this submission" (validation, Helmet, CORS, SSRF-safe design — cái này thật, có code) vs "Production considerations, out of scope" - (WAF, JWT/IdP, TLS, dependency scanning - cái này chỉ để show tư duy, không claim đã code)

## giai đoạn 6: Implement

- Bối cảnh: nhờ Claude soạn plan 7 ngày để implement
- Claude soạn plan rất chi tiết và cụ thể, tôi dựa vào đó để implement.
- Tôi nhờ Claude soạn 1 file skill để đảm bảo luôn follow đúng yêu cầu AGENT_SPEC.md, và tạo prompt để Antigravity có thể implement hiệu quả và ít tốn token nhất.
- Vấn đề: Tôi preview và thấy rất đầy đủ yêu cầu nên tôi đưa Antigravity thực hiện.

## giai đoạn 7: Fix lint

- Bối cảnh: sau khi AI genearte project xong thì tôi lint project để đảm bảo code sạch
- Vấn đề: sau khi chạy npm run lint thì kết quả 28 problems (27 errors, 1 warning)
- Hành động: tôi Gemini hướng dẫn cách fix từng lỗi.

## giai đoạn 8: Debug Helmet + Swagger blank page

- Bối cảnh: Bật Helmet (CSP mặc định) → truy cập /api/docs bị trắng trang hoàn toàn.
- Thử Gemini trước: đề xuất thêm unpkg.com vào CSP whitelist → không fix được, vì Swagger
  UI của @nestjs/swagger thực ra serve asset same-origin, không load từ unpky.com.
- Hỏi Claude: phân tích lại, nghi vấn đầu tiên là thiếu fontSrc/workerSrc trong CSP.
- Vẫn còn lỗi sau khi sửa CSP → console log thực tế cho thấy lỗi khác hẳn: "TLS error
  caused the secure connection to fail" (Safari cố load qua HTTPS dù server chạy HTTP).
- Phát hiện root cause thật: Helmet mặc định bật HSTS, và Safari áp dụng HSTS ngay cả khi
  nhận header qua HTTP (quirk riêng của Safari) → trình duyệt tự ép mọi request sau đó sang
  <https://localhost>, trong khi server không chạy TLS.
- Hành động: tắt HSTS ở môi trường dev (`hsts: false` / theo `NODE_ENV`), đồng thời tắt cả
  CSP cho riêng route /api/docs bằng middleware có điều kiện theo path — không disable
  Helmet toàn cục.
- Vấn đề phụ phát sinh: middleware conditional viết tay dùng type `IncomingMessage`/
  `ServerResponse` (Node thô) thay vì `Request`/`Response`/`NextFunction` của Express →
  ESLint báo "unsafe call", `.path` không tồn tại trên `IncomingMessage`. Sửa lại đúng type
  từ `express`.
- Bài học verification quan trọng: 2 lần chẩn đoán sai liên tiếp (unpkg.com, rồi tưởng vẫn
  là CSP) trước khi tìm ra root cause thật (HSTS/Safari) — minh chứng cho việc không dừng
  lại ở fix đầu tiên "có vẻ đúng", mà tiếp tục đọc console log thực tế để xác nhận.
- Cần phải xóa HSTS cache đã lưu trong Safari (Privacy → Manage Website Data → remove
  localhost) — sửa code không tự động xóa cache trình duyệt đã ghi nhớ trước đó.

## giai đoạn 9: debug source code

- Bối cảnh: Sau khi Antigravity đã dev xong thì tôi bắt đầu đọc source code để đảm bảo code clean và đúng
- Vấn đề: hiện tại MockSalesController và MockServiceController đang tự tạo interface riêng thay vì dùng UnifiedDocument
- Hành động: tôi nhờ Claude gợi ý các tool để analyze source code trước:
jscpd — bắt trùng lặp code (chính là vấn đề vừa rồi)
knip — tìm dead code, unused export, duplicate export
ESLint bổ sung rule chuyên bắt duplication
dependency-cruiser hoặc madge — kiểm tra cấu trúc module đúng như AGENT_SPEC.md
Gộp thành 1 script + chạy tự động trước mỗi commit

## giai đoạn 10: clean source code với knip

- Bối cảnh: clean code với knip
- Vấn đề: sau khi chạy knip thì phát hiện @types/uuid đã được install nhưng không được sử dụng
- Hành động: vì tôi dùng uuid@14.0.1 nên không cần @types/uuid nữa
- Vấn đề 2: pino-pretty có sử dụng nhưng được khai báo dựa theo transport: { target: 'pino-pretty' } nên knip không phát hiện
- Hành động: tôi bổ sung thêm knip.json để ignore

## giai đoạn 11: verify requirement

- Design Doc mô tả OpenTelemetry nhưng code ban đầu (Antigravity generate) thiếu — tự phát hiện qua việc đối chiếu Design Doc với source code thực tế, bổ sung implementation để đảm bảo tính nhất quán giữa tài liệu và code.

## giai đoạn 12: timeout bị double config

- Review lại circuit-breaker.factory.ts, thấy opossum cũng set timeout, mà client cũng có
  timeout riêng rồi. Dư 1 chỗ.
- opossum timeout chỉ race promise thôi, không hủy được request thật đang chạy.
- Bỏ timeout ở opossum, chỉ giữ ở client. Breaker vẫn hoạt động bình thường vì nó đếm
  fail/success, không cần tự đếm giờ.

---

## giai đoạn 13: OpenTelemetry lỗi liên tục

- Implement OTel theo Design Doc (code Antigravity lúc đầu thiếu phần này).
- Lỗi 1: `addSpanProcessor is not a function`. Xem code thấy Antigravity ghi
  `(provider as any).addSpanProcessor(...)` — dùng any để né lỗi, không tìm hiểu tại sao.
  SDK v2 bỏ method này rồi, giờ phải truyền spanProcessors lúc khởi tạo.
- Lỗi 2: `register does not exist`. Sai class, `.register()` chỉ có ở NodeTracerProvider.
- Lỗi 3: test fail, `parentSpanId` undefined. SDK v2 đổi thành `parentSpanContext.spanId`.
- 3 lỗi cùng 1 gốc: AI code theo API cũ, mình cài bản mới (2.9.0). Any che mất lỗi thật,
  đáng lẽ báo ngay lúc compile mà giờ mới lòi ra lúc chạy test. Lần sau thấy any/eslint-
  disable là phải check kỹ, không tin liền.

---

## giai đoạn 14: lint lỗi ở pino serializers

- Thêm serializers cho pino cho log gọn bớt.
- ESLint báo unsafe assignment, do `req` bị suy ra any.
- Sửa: khai rõ type Request/Response từ express, giống lần sửa Helmet trước.

---

## giai đoạn 15: dọn OpenTelemetry — log rối + thiếu dependency

- Console dump nguyên object span, duration tính bằng microsecond nhìn như bug, thực ra
  không sao, chỉ khó đọc.
- Nhờ AI viết riêng 1 exporter gọn, in mỗi span 1 dòng: tên, ms, status, traceId ngắn.
- Xong bị pre-commit fail: thiếu @opentelemetry/core trong package.json (exporter mới
  dùng ExportResult/ExportResultCode từ đó, chỉ có sẵn gián tiếp qua package khác kéo
  theo). npm install lại cho đủ.
- Test không đổi gì, vẫn InMemorySpanExporter như cũ.

---

## giai đoạn 16: root span cứ hiện UNSET

- Sau khi log gọn lại thấy documents.searchByVin lúc nào cũng UNSET dù response 200, 2
  child span thì OK bình thường.
- Root span chưa bao giờ gọi setStatus() — chỉ có setAttribute thôi.
- Thêm setStatus(OK) ở nhánh cache hit + thành công, thêm catch để set ERROR khi lỗi rồi
  throw lại như cũ. Tiện phát hiện luôn 2 child span thiếu attribute vin/correlationId,
  thêm nốt.

---

## giai đoạn 17: dọn git history, không gom về 1 commit

- Định squash hết về 1 commit cho gọn.
- Nghĩ lại — history hiện tại chính là bằng chứng cho cả quá trình đã ghi trong file này.
  Gom về 1 commit là mất hết bằng chứng, chỉ còn nói suông.
- Dùng git rebase -i, chỉ gộp đúng 2 cặp trùng thật (2 commit husky giống hệt nhau, 2
  commit OTel do lần đầu code lỗi rồi commit tiếp bản fix).
- Check thêm .env/dist/.DS_Store không bị track — ổn từ đầu. Gỡ playwright-report và
  test-results ra khỏi git vì đó là output chạy test, không nên có trong repo nộp.
- Push bằng --force-with-lease cho an toàn.

---

## giai đoạn 18: record a video demo

- Record video demo thì phát hiện Architecture diagram thiếu mũi tên response từ Aggregator về Client
- Sequence diagram lại bị sai
- Cả 2 lỗi trên đều liên quan đến việc design và code không match nhau, và không được phát hiện qua test
- Tôi nhờ Claude generate lại 2 diagram trên và thấy hợp lý hơn
