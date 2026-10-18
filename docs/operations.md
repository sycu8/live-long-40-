# Vận hành VivaAge

## Cloudflare Access cho `/admin`

1. Zero Trust → Access → Applications → Self-hosted  
2. Application domain: `your-worker.workers.dev`  
3. Path: `/admin*` (và tuỳ chọn `/api/v1/admin*`)  
4. Policy: allow email / IdP nhóm biên tập  

Worker kiểm tra header `Cf-Access-Jwt-Assertion`. Staging local dùng `Authorization: Bearer $ADMIN_SHARED_SECRET`.

## AI Search instance

Tạo instance tên khớp `AI_SEARCH_INSTANCE` (`song-an-40-knowledge`). Khi admin approve, Worker gọi `items.upload` với metadata (`status`, `review_status`, `source_id`, …).

## AI Gateway

Đặt `AI_GATEWAY_ID`. Inference đi qua `env.AI.run(model, inputs, { gateway: { id } })` để có rate/cost controls. `env.AI.gateway(id)` chỉ dùng cho log/URL (`patchLog`, `getLog`, `getUrl`); `gateway.run()` là universal endpoint và nhận `{ provider, endpoint, headers, query }`. Tắt full prompt logging cho chat cá nhân hóa trên dashboard Gateway.

## Blog — lịch hàng ngày & crawl

Xem `docs/blog-schedule.md`. Tóm tắt:

- Cron `0 2 * * *` publish bài đến hạn + lấp lịch 21 ngày
- `/sitemap.xml`, `/robots.txt`, `/feed.xml` do Worker phục vụ (không phải file tĩnh SPA)
- Admin: `POST /api/v1/admin/blog/run-schedule`
