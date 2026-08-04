# Sống An 40+

Progressive Web App giúp người Việt từ tuổi **40+** chuẩn bị cho tuổi già qua đánh giá sẵn sàng, kế hoạch 30 ngày, thư viện giáo dục và chatbot trả lời có nguồn.

> Công cụ giáo dục và lập kế hoạch — **không** phải ứng dụng Nhà nước, không thay thế bác sĩ, tư vấn tài chính hay tư vấn pháp lý.

## Kiến trúc

| Lớp | Công nghệ |
| --- | --- |
| Frontend | React + Vite + Tailwind (Workers Static Assets, SPA) |
| API | Hono trên Cloudflare Workers |
| Dữ liệu | D1 (quan hệ), R2 (tài liệu nguồn), KV (cấu hình công khai) |
| AI | Workers AI + AI Gateway + Cloudflare AI Search |
| Nạp liệu | Queues + Workflows |
| Bảo vệ admin | Cloudflare Access (+ secret dự phòng local) |
| Chống lạm dụng | Turnstile (khi cấu hình secret) |

## Cấu trúc thư mục

```
client/          # React PWA
worker/          # Hono API, AI pipeline, admin, workflows
shared/          # Schemas, scoring/safety/plan rules, constants
migrations/      # D1 SQL migrations
seed/            # Demo lessons + approved knowledge chunks
tests/           # Vitest unit + Playwright e2e
docs/            # Ghi chú vận hành
```

## Yêu cầu local

- Node.js 22+
- pnpm 9+
- Wrangler 4+ (đã có trong devDependencies)

## Thiết lập local (chính xác)

```bash
corepack enable
pnpm install

# Áp migration D1 local (Miniflare)
pnpm db:migrate:local

# Nạp bài học demo + chunk tri thức đã duyệt
pnpm db:seed:local

# Sinh kiểu Env từ wrangler.jsonc
pnpm cf:types

# Chạy app (Vite + Cloudflare Workers runtime)
# Mặc định tắt remote bindings để không cần CLOUDFLARE_API_TOKEN.
# Khi đã xác thực Cloudflare, đặt cloudflare({ remoteBindings: true }) trong vite.config.ts
# để dùng Workers AI / AI Search thật.
pnpm dev
```

Mở `http://127.0.0.1:5173`.

### Kiểm tra nhanh

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm deploy:dry-run
```

End-to-end (cần Chromium Playwright):

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## Cloudflare bindings cần provision

Trong `wrangler.jsonc`:

| Binding | Loại | Tên gợi ý |
| --- | --- | --- |
| `DB` | D1 | `song-an-40-db` |
| `SOURCES` | R2 | `song-an-40-sources` |
| `CONFIG` | KV | public config / flags |
| `AI` | Workers AI | — |
| `AI_SEARCH` | AI Search namespace `default` | instance `song-an-40-knowledge` |
| `INGESTION_QUEUE` | Queue | `song-an-40-ingestion` (+ DLQ) |
| `ANALYTICS_QUEUE` | Queue | `song-an-40-analytics` |
| `INGESTION_WORKFLOW` | Workflow | class `IngestionWorkflow` |
| `ASSETS` | Static Assets | SPA |

### Secrets (`wrangler secret put`)

- `SESSION_SIGNING_SECRET` (tuỳ chọn, dự phòng)
- `TURNSTILE_SECRET_KEY`
- `ADMIN_SHARED_SECRET` (chỉ cho local/staging khi chưa có Access)

Biến công khai: `TURNSTILE_SITE_KEY`, `AI_GATEWAY_ID`, `AI_SEARCH_INSTANCE`, versions (`PROMPT_VERSION`, `SCORING_RULESET_VERSION`, …).

## Deploy lên Cloudflare

### Tài khoản thật (khuyến nghị)

Cần `CLOUDFLARE_API_TOKEN` (Workers + D1 + R2 + KV + Queues + AI) và `CLOUDFLARE_ACCOUNT_ID`.

```bash
export CLOUDFLARE_API_TOKEN=…
export CLOUDFLARE_ACCOUNT_ID=…
# Tạo D1/KV/R2/Queues, cập nhật ID trong wrangler.jsonc
pnpm build
pnpm db:migrate:remote
pnpm exec wrangler secret put SESSION_SIGNING_SECRET
pnpm exec wrangler secret put ADMIN_SHARED_SECRET   # staging only; prod dùng Access
pnpm exec wrangler deploy
# Tuỳ chọn: pnpm exec wrangler d1 execute song-an-40-db --remote --file=./seed/demo.sql
```

`wrangler.jsonc` đầy đủ gồm R2, Workflows, AI Search. Binding thiếu sẽ được Worker xử lý mềm (admin upload R2 → 503).

### Preview tạm (không cần login)

```bash
pnpm deploy:preview
# hoặc: node scripts/deploy-preview.mjs
```

Dùng temporary preview account (`wrangler deploy --temporary`). Hỗ trợ D1/KV/Queues/AI; **không** hỗ trợ R2/Workflows/AI Search (`wrangler.preview.jsonc`). Claim account trong ~60 phút qua URL Wrangler in ra, nếu không preview hết hạn.

### Staging production-like

1. Tạo D1, R2, KV, Queues trên account Cloudflare.
2. Cập nhật `database_id` / KV `id` trong `wrangler.jsonc` (hoặc dùng auto-provision Wrangler nếu bật).
3. Tạo AI Gateway id `song-an-40` và AI Search instance `song-an-40-knowledge` trong namespace `default`.
4. Cấu hình Cloudflare Access application bảo vệ đường dẫn `/admin*`.
5. Đặt secrets.
6. Chạy:

```bash
pnpm db:migrate:remote
pnpm build
pnpm exec wrangler deploy --env staging
```

7. (Tuỳ chọn) Seed remote chỉ với nội dung giáo dục đã duyệt — **không** seed tài liệu giả mạo cơ quan nhà nước.

## Luồng người dùng chính

1. **Landing** → bắt đầu đánh giá hoặc hỏi đáp  
2. **Đánh giá ~20 câu** → điểm health / finance / caregiving (ruleset deterministic)  
3. **Kết quả** → khoảng trống + điểm mạnh + giải thích  
4. **Kế hoạch 30 ngày** → 2 việc chính + 1 tùy chọn mỗi tuần  
5. **Hỏi Sống An** → risk route → retrieve → generate có citation  
6. **Thư viện** → bài học theo nhóm  
7. **Admin** → upload/R2, ingest workflow, approve, withdraw  

## AI & retrieval

1. Chuẩn hóa câu hỏi (giữ nguyên bản + dạng không dấu)  
2. Định tuyến rủi ro cao (config versioned)  
3. Phân loại chủ đề  
4. Truy vấn AI Search (chỉ nguồn `active` + `approved`)  
5. Ngưỡng điểm tối thiểu; thiếu bằng chứng → abstain  
6. Sinh câu trả lời qua Workers AI (qua AI Gateway khi có)  
7. Kiểm tra citation ID khớp retrieval  
8. Stream SSE về trình duyệt  

**Local fallback:** nếu AI Search/Workers AI không có, hệ thống dùng tìm kiếm từ khóa trên `source_chunks` đã duyệt và/hoặc thông báo rõ *chế độ phát triển* — không giả làm câu trả lời production.

## Quyền riêng tư & an toàn

- Cookie session HttpOnly + SameSite; CSRF cho mutation  
- Không lưu transcript chat trừ khi opt-in  
- CSP + security headers  
- Rate limit chat / feedback / tạo assessment  
- Service worker **không** cache API nhạy cảm  
- Admin audit events  
- High-risk: không sinh hướng dẫn điều trị  

## Scripts

| Script | Mục đích |
| --- | --- |
| `pnpm dev` | Local Wrangler/Vite |
| `pnpm typecheck` | TypeScript project references |
| `pnpm lint` | oxlint |
| `pnpm test` | Vitest unit |
| `pnpm test:e2e` | Playwright |
| `pnpm build` | Production build |
| `pnpm db:migrate:local` / `remote` | D1 migrations |
| `pnpm db:seed:local` | Demo data |
| `pnpm deploy:dry-run` | Validate deploy bundle |
| `pnpm deploy:preview` | Deploy preview (token hoặc temporary account) |

## Known limitations

- AI Search và Workers AI cần tài nguyên Cloudflare thật; local dùng fallback có gắn nhãn.  
- PDF: lưu R2 được, nhưng **bắt buộc** dán văn bản đã duyệt trước khi index (không giả PDF extraction).  
- Turnstile chỉ enforce khi có `TURNSTILE_SECRET_KEY`.  
- Cloudflare Access JWT được chấp nhận qua header; không tự verify chữ ký JWT trong MVP (giả định Access edge).  
- Temporary preview workers.dev có thể bật Cloudflare challenge; R2/Workflows không có trên preview account.
