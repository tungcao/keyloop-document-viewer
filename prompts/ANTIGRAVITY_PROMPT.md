# Prompt để dán vào Antigravity IDE

Dán nguyên văn đoạn dưới đây làm prompt đầu tiên trong session. Đặt `SYSTEM_DESIGN.md` và
`AGENT_SPEC.md` vào root của repo TRƯỚC khi chạy prompt này.

---

```
Read SYSTEM_DESIGN.md once for architecture context, then read AGENT_SPEC.md — that file
is the authoritative implementation spec. Follow AGENT_SPEC.md exactly: file structure,
contracts, business logic, testing requirements, and the "explicitly out of scope" list.

Implement strictly in the order listed in AGENT_SPEC.md Section 7, one step at a time.
After each step, show me a short summary of what was created/changed (file names + one
line each) — do not paste full file contents in chat unless I ask. Do not re-explain the
architecture back to me. Do not ask clarifying questions — if something is ambiguous,
follow the ASSUMPTION convention described in AGENT_SPEC.md Section 0 and keep going.

Stop after each numbered step in Section 7 and wait for me to say "next" before continuing,
so I can review incrementally.
```

---

## Tại sao prompt này tiết kiệm token

- Agent đọc file 1 lần, không phải bạn gõ lại kiến trúc/business logic mỗi turn.
- Yêu cầu "tóm tắt ngắn, không paste full code trong chat" — vì code đã nằm trong file thật
  trên disk, hiển thị lại trong chat chỉ tốn token vô ích, bạn xem trực tiếp trong IDE.
- "Không hỏi lại, tự assume theo convention" — tránh vòng lặp hỏi-đáp qua lại tốn token.
- Chia nhỏ theo step + dừng chờ "next" — giúp bạn kiểm soát, dừng sớm nếu agent đi sai hướng
  thay vì để nó chạy hết 13 bước rồi mới phát hiện lỗi từ bước 3 (vừa tốn token vừa phải sửa
  nhiều).

## Cách dùng từng "next"

Sau mỗi step, bạn chỉ cần nhắn `next` nếu ổn, hoặc sửa ngắn gọn nếu cần, ví dụ:

```
next, nhưng đổi CACHE_TTL_SECONDS default trong .env.example thành 90
```

Nếu muốn dừng agent lại kiểm tra kỹ hơn ở bước nào đó (đặc biệt bước 7 — business logic
core), có thể nhắn:

```
before continuing, show me documents.service.ts in full
```
