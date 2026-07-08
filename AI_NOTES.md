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
