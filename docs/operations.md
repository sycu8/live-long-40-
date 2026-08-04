# Vận hành Sống An 40+

## Cloudflare Access cho `/admin`

1. Zero Trust → Access → Applications → Self-hosted  
2. Application domain: `your-worker.workers.dev`  
3. Path: `/admin*` (và tuỳ chọn `/api/v1/admin*`)  
4. Policy: allow email / IdP nhóm biên tập  

Worker kiểm tra header `Cf-Access-Jwt-Assertion`. Staging local dùng `Authorization: Bearer $ADMIN_SHARED_SECRET`.

## AI Search instance

Tạo instance tên khớp `AI_SEARCH_INSTANCE` (`song-an-40-knowledge`). Khi admin approve, Worker gọi `items.upload` với metadata (`status`, `review_status`, `source_id`, …).

## AI Gateway

Đặt `AI_GATEWAY_ID`. Pipeline ưu tiên `env.AI.gateway(id).run(...)` để có rate/cost controls; tắt full prompt logging cho chat cá nhân hóa trên dashboard Gateway.
