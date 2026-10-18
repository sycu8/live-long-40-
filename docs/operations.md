# Vận hành VivaAge

## Cloudflare Access cho `/admin`

1. Zero Trust → Access → Applications → Self-hosted  
2. Application domain: `your-worker.workers.dev`  
3. Path: `/admin*` (và tuỳ chọn `/api/v1/admin*`)  
4. Policy: allow email / IdP nhóm biên tập  

Worker kiểm tra header `Cf-Access-Jwt-Assertion`. Staging local dùng `Authorization: Bearer $ADMIN_SHARED_SECRET`.

## AI Search instance

Tạo instance tên khớp `AI_SEARCH_INSTANCE` (`song-an-40-knowledge`). Khi admin approve, Worker gọi `items.upload` với metadata (`status`, `review_status`, `source_id`, …).

## Workers AI

Chat và blog gọi `env.AI.run(model, inputs)` trực tiếp trên binding `AI`. Không đặt `AI_GATEWAY_ID`: gateway `song-an-40` chưa được cấu hình và trả lỗi 2001.

## Blog — lịch hàng ngày & crawl

Xem `docs/blog-schedule.md`. Tóm tắt:

- Cron `0 2 * * *` publish bài đến hạn + lấp lịch 21 ngày
- `/sitemap.xml`, `/robots.txt`, `/feed.xml` do Worker phục vụ (không phải file tĩnh SPA)
- Admin: `POST /api/v1/admin/blog/run-schedule`
